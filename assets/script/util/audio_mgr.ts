import { G } from "./global_def";
import { HDMap } from "./structure/hd_map";
import { GameStorage, SaveDef } from "./game_storage";
import { TimedTaskInst } from "./timed_task";
import { GameEventMgrInst, EventType } from "./event_mgr";
import { WxUtil } from "./wx_util";

//Bgm类型枚举，除了kNone字段外必须与kBgms数组中的元素一一对应
export enum BgmType {
    kMenu,
    kNone = 9999,
}

const kBgms = [
    'bgm_menu'
]

//Sfx类型枚举，除了kNone字段外必须与kSfxSet数组中的元素一一对应
export enum SfxType {
    kGoodClick,
    kLuckyBox,
    kNone = 9999
}

const kSfxSet = [
    'goodClick',
    'luckybox',
]

/**
 * 暂停音频的的类型，不同的类型暂停和恢复的处理不同
 * 比如，在观看视频时音频会被暂停播放，这时候切后台会再调用一次音频暂停，
 * 切前台后会调用一次音频恢复，这两次调用都会无效，直到看视频结束或者取消观看视频后才真正恢复播放
 */
export enum AudioPauseType {
    kNorm, //普通
    kVideoAd, //观看视频广告
    kBackend //切后台
}

//用于管理音频操作的类，是一个单例，可以直接在各处进行调用
export class AudioMgr {
    public static instance: AudioMgr = new AudioMgr()

    private bMuteMusic_ = false;
    private bMuteSound_ = false;

    private pauseType_ = AudioPauseType.kNorm

    private curBgmType_ = BgmType.kNone

    private bgmId_ = 0

    private maxBgmVol_ = 1
    private maxSfxVol_ = 1

    private maxFadeVol_ = 0

    private bgms_: HDMap = new HDMap()
    private sfxMap_: HDMap = new HDMap()

    //bgm远程加载延迟的话，可能导致资源还未下载就执行了播放操作，导致播放失败，
    //此时记录一个需要播放的bgm索引，在加载完毕后自动播放
    private bgmRemoteDelayType_ = BgmType.kNone 

    private fadeTimeTaskId_ = 0

    private bgmProcCb_ = null //bgm加载进度回调，回调函数形式为function(cnt, total)
    private sfxProcCb_ = null //音效加载进度回调
    private bgmProcCnt_ = 0
    private bgmProcTotal_ = 0
    private sfxProcCnt_ = 0
    private sfxProcTotal_ = 0

    private url_ = "audio/"

    isStopMusic()
    {
        return this.bMuteMusic_;
    }

    isStopSound()
    {
        return this.bMuteSound_;
    }

    init() 
    {
        this._readData()

        GameEventMgrInst.addListener(EventType.kAudioPause, this._pauseCallback.bind(this), true)
        GameEventMgrInst.addListener(EventType.kAudioResume, this._resumeCallback.bind(this), true)
    }

    /**
     * 在各个支持分包的平台中，通常音频不需要留在主包中加载，作为分包在需要的时候进行加载
     * @param sucCb 分包加载成功回调
     * @param failCb 分包加载失败回调
     */
    public loadPackage(sucCb?: Function, failCb?: Function)
    {
        if(G.isMinigamePlat)
        {
            G.log("[AudioMgr loadPackage] start")

            cc.loader.downloader.loadSubpackage('audio', (err: any) => {
                if (err)
                {
                    G.log("[AudioMgr loadPackage] fail", err)

                    if(failCb)
                        failCb()
                }
                else
                {
                    G.log("[AudioMgr loadPackage] succ")

                    //load audio dir test
                    // cc.loader.loadResDir("audio", (err, arr, urls)=>{
                    //     console.log('urls', urls)
                    // })

                    if(sucCb)
                        sucCb()
                }
            })
        }
        else
        {
            if(sucCb)
                sucCb()
        }
    }

    //预加载所有的音频资源，不建议在音频资源很大很多的情况下使用
    //如果音频资源很大，建议使用拆分开来的预加载策略，要用到时就加载，用完即释放
    /**
     * 
     * @param bgmProcCb bgm加载进度回调，格式function(cnt, total),cnt指当前加载进度，total指总的加载进度
     * @param sfxProcCb 音效加载进度回调，格式function(cnt, total),cnt指当前加载进度，total指总的加载进度
     */
    public preloadAll(bgmProcCb = null, sfxProcCb = null)
    {
        for(let i = 0; i < kBgms.length; ++i)
        {
            if(!this.bgms_.containsKey(i))
            {
                ++this.bgmProcTotal_
                G.readAudio(this.url_ + kBgms[i], this._loadBgm.bind(this), i)
            }
        }

        for(let i = 0; i < kSfxSet.length; ++i)
        {
            if(!this.sfxMap_.containsKey(i))
            {
                ++this.sfxProcTotal_
                G.readAudio(this.url_ + kSfxSet[i], this._loadSfx.bind(this), i)
            }
        }

        this.bgmProcCb_ = bgmProcCb
        this.sfxProcCb_ = sfxProcCb
    }

    //预加载某个枚举范围内的bgm
    /**
     * @param t2 可选参数，默认为kNone，默认情况下，仅加载t1指定的单个bgm
     * @param procCb bgm加载进度回调，格式function(cnt, total),cnt指当前加载进度，total指总的加载进度
     * 
        enum BgmType {
            kMenu,
            kEnemyNorm,
            kEnemyBoss,
        }

        AudioMgr.instance.preloadBgmInEnumRange(BgmType.kMenu) //仅加载kMenu
        AudioMgr.instance.preloadBgmInEnumRange(BgmType.kEnemyNorm, BgmType.kEnemyBoss) //加载kEnemyNorm与kEnemyBoss
        AudioMgr.instance.preloadBgmInEnumRange(BgmType.kEnemyNorm, BgmType.kEnemyBoss, (cnt, total)=> {
            let per = cnt / total
        }) //加载kEnemyNorm与kEnemyBoss，并且带进度回调
     */
    public preloadBgmInEnumRange(t1: BgmType, t2 = BgmType.kNone, procCb = null)
    {
        if(t2 != BgmType.kNone)
        {
            for(let i = t1; i <= t2; ++i)
            {
                if(!this.bgms_.containsKey(i))
                {
                    ++this.bgmProcTotal_
                    G.readAudio(this.url_ + kBgms[i], this._loadBgm.bind(this), i)
                }
            }
        }
        else
        {
            if(!this.bgms_.containsKey(t1))
            {
                ++this.bgmProcTotal_
                G.readAudio(this.url_ + kBgms[t1], this._loadBgm.bind(this), t1)
            }
        }

        this.bgmProcCb_ = procCb
    }

    //释放指定枚举范围内的bgm，请务必保证与与preloadBgmInEnumRange一致的参数调用
    public releaseBgmInEnumRange(t1: BgmType, t2 = BgmType.kNone)
    {
        cc.audioEngine.stopMusic()
        if(t2 == BgmType.kNone)
        {
            if(this.bgms_.containsKey(t2))
            {
                cc.loader.release(this.bgms_.get(t2))
                this.bgms_.remove(t2)
            }
        }
        else
        {
            for(let i = t1; i <= t2; ++i)
            {
                if(this.bgms_.containsKey(i))
                {
                    cc.loader.release(this.bgms_.get(i))
                    this.bgms_.remove(i)
                }
            }
        }
    }

    //预加载某个枚举范围内的音效，与bgm不同的是一般会有多个音频需要经常播放，所以不提供单独加载音频的接口
    /**
     * @param procCb 音效加载进度回调，格式function(cnt, total),cnt指当前加载进度，total指总的加载进度
     * 
        enum SfxType {
            kButton,
            kShoot,
            kJump,
        }

        AudioMgr.instance.preloadSfxInEnumRange(SfxType.kButton, SfxType.kJump, (cnt, total)=> { 
            let percent = cnt / total
        })
     */
    public preloadSfxInEnumRange(t1: SfxType, t2: SfxType, procCb = null)
    {
        for(let i = t1; i <= t2; ++i)
        {
            if(!this.sfxMap_.containsKey(i))
            {
                ++this.sfxProcTotal_
                G.readAudio(this.url_ + kSfxSet[i], this._loadSfx.bind(this), i)
            }
        }

        this.sfxProcCb_ = procCb
    }

    //释放指定枚举范围内的音效，请务必保证与preloadSfxInEnumRange一致的参数调用
    public releaseSfxInEnumRange(t1: SfxType, t2: SfxType)
    {
        cc.audioEngine.stopAllEffects()
        for(let i = t1; i <= t2; ++i)
        {
            if(!this.sfxMap_.containsKey(i))
            {
                cc.loader.release(this.sfxMap_.get(i))
                this.sfxMap_.remove(i)
            }
        }
    }

    //设置是否禁止播放bgm
    public setIfMuteMusic(bVal: boolean)
    {
    	let bMute = this.bMuteMusic_
        this.bMuteMusic_ = bVal
        if(bVal)
        {
            if(G.isMinigamePlat)
            {
                this.pauseMusic()
            }
            else
                cc.audioEngine.stopMusic()
        }
        else
        {
            if(G.isMinigamePlat)
            {
                this.resumeMusic()
            }
            else
                this.bgmId_ = cc.audioEngine.playMusic(this.bgms_.get(this.curBgmType_), true)
        }

        if(bMute != bVal)
            this._saveData()
    }

    //设置是否禁止播放音效
    public setIfMuteSound(bVal: boolean)
    {
    	let bMute = this.bMuteSound_
        this.bMuteSound_ = bVal
        // cc.audioEngine.stopAllEffects()

        if(bMute != bVal)
            this._saveData()
    }

    //设置背景音乐音量
    public setBgmVolume(val: number)
    {
        this.maxBgmVol_ = val
        cc.audioEngine.setMusicVolume(val)

        if(!G.isEqualF(val, this.maxBgmVol_))
            this._saveData()
    }

    //设置音效音量
    public setSfxVolume(val: number)
    {
        this.maxSfxVol_ = val
        cc.audioEngine.setEffectsVolume(val)

        if(!G.isEqualF(val, this.maxSfxVol_))
            this._saveData()
    }

    private _saveData()
    {
        let sav = {
            bMuteBgm: this.bMuteMusic_,
            bMuteSfx: this.bMuteSound_,
            maxBgmVol: this.maxBgmVol_,
            maxSfxVol: this.maxSfxVol_
        }

        GameStorage.writeJSON(SaveDef.kAudio, sav)
    }

    private _readData()
    {
        let sav = GameStorage.readJSON(SaveDef.kAudio)
        if(G.isExistObj(sav))
        {
            this.bMuteMusic_ = sav.bMuteBgm
            this.bMuteSound_ = sav.bMuteSfx
            this.maxBgmVol_ = sav.maxBgmVol
            this.maxSfxVol_ = sav.maxSfxVol
        }
        else
            this._saveData()

        this.setBgmVolume(this.maxBgmVol_)
        this.setSfxVolume(this.maxSfxVol_)
    }

    //bRemote 当音频要通过远程加载时，指定该值为true，避免执行播放操作时资源还没下载完成的播放失败的情况
    public playMusic(type: BgmType, bRemote = false)
    {
        cc.audioEngine.stopMusic()
        
        if(type !== BgmType.kNone)
        {
            this.curBgmType_ = type
            if(this.bgms_.containsKey(type))
            {
                if(!this.bMuteMusic_)
                {
                    if(G.isMinigamePlat)
                    {
                        let res = this.bgms_.get(type) as cc.AudioClip
                        WxUtil.playAudio(res.url, true)
                    }
                    else
                        this.bgmId_ = cc.audioEngine.playMusic(this.bgms_.get(type), true);
                }
            }
            else if(bRemote)
                this.bgmRemoteDelayType_ = type
            else
                G.readAudio(this.url_ + kBgms[type], this._loadBgm.bind(this), type, !this.bMuteMusic_)
        }
    }

    public replayMusic()
    {
        if(this.curBgmType_ && this.bgms_.containsKey(this.curBgmType_))
        {
            this.stopMusic()
            this.playMusic(this.curBgmType_)
        }
    }

    /**
     * 恢复bgm
     * @param pauseType 暂停类型，0 普通 1 观看视频 2 切后台 
     */
    public resumeMusic(pauseType = AudioPauseType.kNorm)
    {
        if(this.pauseType_ == AudioPauseType.kVideoAd)
        {
            if(pauseType != AudioPauseType.kVideoAd)
                return
            else
                this.pauseType_ = AudioPauseType.kNorm
        }
        else
            this.pauseType_ = pauseType

        if(!this.bMuteMusic_)
        {
            if(G.isMinigamePlat)
            {
                let name = this.bgms_.get(this.curBgmType_)
                if(name)
                    WxUtil.resumeAudio(name)
            }
            else
                cc.audioEngine.resumeMusic()
        }
    }

    /**
     * 暂停bgm
     * @param pauseType 暂停类型，0 普通 1 观看视频 2 切后台 
     */
    public pauseMusic(pauseType = AudioPauseType.kNorm)
    {
        if(this.pauseType_ == AudioPauseType.kVideoAd)
        {

        }
        else
            this.pauseType_ = pauseType

        if(G.isMinigamePlat)
        {
            let name = this.bgms_.get(this.curBgmType_)
            if(name)
                WxUtil.pauseAudio(name)
        }
        else
            cc.audioEngine.pauseMusic()
    }

    public stopMusic()
    {
        if(G.isMinigamePlat)
        {
            let res = this.bgms_.get(this.curBgmType_)
            if(res)
                WxUtil.stopAudio(res.url)
        }
        else
            cc.audioEngine.stopMusic()
    }

    public stopEffects()
    {
        cc.audioEngine.stopAllEffects()
    }

    //通过淡入淡出的方式改变bgm，使用前必须要预加载好指定的bgm
    /**
     * 
     * @param t 下一首bgm的类型
     * @param fadeDura 淡入淡出总耗时，会被淡入淡出两个步骤平分，默认为1s，则意味着0.5s淡出旧bgm，0.5s淡入新bgm
     */
    public changeBgmWithFade(t: BgmType, fadeDura = 1)
    {
        TimedTaskInst.remove(this.fadeTimeTaskId_)

        if(this.maxFadeVol_ > 0)
            this.maxBgmVol_ = this.maxFadeVol_

        this.maxFadeVol_ = this.maxBgmVol_
        let maxBgmVol = this.maxBgmVol_
        let interval = fadeDura / 10
        let fadeSpd = this.maxFadeVol_ / 10 * 2
        let bPlayed = false
        
        this.fadeTimeTaskId_ = TimedTaskInst.add(()=> {
            if(this.maxBgmVol_ > 0 && !bPlayed)
            {
                this.maxBgmVol_ -= fadeSpd
                if(this.maxBgmVol_ <= 0)
                {
                    this.maxBgmVol_ = 0
                    this.playMusic(t)
                    bPlayed = true
                }
            }
            else
            {
                this.maxBgmVol_ += fadeSpd
                if(this.maxBgmVol_ >= maxBgmVol)
                {
                    this.maxBgmVol_ = maxBgmVol
                }
            }

            G.log(this.maxBgmVol_)
            this.setBgmVolume(this.maxBgmVol_)

        }, 0, 10, interval)
    }

    public playSound(type: SfxType, bLoop = false)
    {
        if(type !== SfxType.kNone)
            this._playSfx(type, bLoop)
    }

    private _loadBgm(res: cc.AudioClip, idx: number, bPlay = false)
    {
        this.bgms_.put(idx, res)

        if(this.bgmRemoteDelayType_ != BgmType.kNone && this.bgmRemoteDelayType_ == idx)
        {
            this.playMusic(this.bgmRemoteDelayType_)

            this.bgmRemoteDelayType_ = BgmType.kNone
        }
        else if(bPlay)
        {
            this.playMusic(idx)
        }

        ++this.bgmProcCnt_
        if(this.bgmProcCb_)
        {
            this.bgmProcCb_(this.bgmProcCnt_, this.bgmProcTotal_)
            if(this.bgmProcCnt_ >= this.bgmProcTotal_)
                this.bgmProcCb_ = null
        }
    }

    private _loadSfx(res: cc.AudioClip, idx: number, bPlay = false, bLoop = false)
    {
        this.sfxMap_.put(idx, res)
        if(bPlay && !this.bMuteSound_)
        {
            this._playSfx(idx, bLoop)
        }

        ++this.sfxProcCnt_
        if(this.sfxProcCb_)
        {
            this.sfxProcCb_(this.sfxProcCnt_, this.sfxProcTotal_)
            if(this.sfxProcCnt_ >= this.sfxProcTotal_)
                this.sfxProcCb_ = null
        }
    }

    //统一的音效播放接口，使用者自行实现公开的音效播放方法
    /*例：
        private playButton()
        {
            this._playSfx(this.sfxArr_[SfxType.kButton])
        }
    */
    private _playSfx(type: SfxType, bLoop = false) 
    {
        if(this.sfxMap_.containsKey(type))
        {
            if(!this.bMuteSound_)
            {
                if(G.isMinigamePlat)
                {
                    let res = this.sfxMap_.get(type) as cc.AudioClip
                    WxUtil.playAudio(res.url, true)
                }
                else
                    cc.audioEngine.playEffect(this.sfxMap_.get(type), bLoop);
            }
        }
        else
            G.readAudio(this.url_ + kSfxSet[type], this._loadSfx.bind(this), type, !this.bMuteSound_, bLoop)
    }

    private _pauseCallback(sender, data)
    {
        this.pauseMusic(data ? data.pauseType : AudioPauseType.kNorm)
    }

    private _resumeCallback(sender, data)
    {
        this.resumeMusic(data ? data.pauseType : AudioPauseType.kNorm)
    }
}

export const AudioMgrInst = AudioMgr.instance