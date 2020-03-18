//游戏逻辑调度，作为一个整个游戏生命周期都存在的单例，可以完成很多单一实例的转接工作

import { G } from "./util/global_def";
import { GameStorage, SaveDef } from "./util/game_storage";
import { GameEventMgr } from "./util/event_mgr";
import { AudioMgr, AudioPauseType } from "./util/audio_mgr";
import { TimedTaskMgr } from "./util/timed_task";
import { HDSDK } from "./HDSDK";
import { GameUserInfo } from "./game/user_info";
import { DataHub } from "./data/data_hub";
import { ExportUI } from "./game_ui/common/export_ui";
import { WxUtil } from "./util/wx_util";
import { GameSetting } from "./game_setting";

const {ccclass, property} = cc._decorator;

const kUnionID = false

@ccclass
export class GameLogic extends cc.Component {
    public static instance = null

    private gameEvtMgr_: GameEventMgr = null
    private timedTaskMgr_: TimedTaskMgr = null
    private exportUI_: ExportUI = null

    private fpsSum_ = 0
    private frames_ = 0
    private bRecDt_ = false

    bLogined = false //是否已经登录，无论失败还是成功会置为true

    onLoad()
    {
        GameLogic.instance = this

        this.init()

        cc.game.addPersistRootNode(this.node)
    }

    init () 
    {
        cc.dynamicAtlasManager.enabled = false

        cc.game.setFrameRate(GameSetting.framerate)

        if(this.gameEvtMgr_ == null)
            this.gameEvtMgr_ = GameEventMgr.instance
        this.gameEvtMgr_.init()

        if(this.timedTaskMgr_ == null)
            this.timedTaskMgr_ = TimedTaskMgr.instance
        this.timedTaskMgr_.clear()

        if(this.exportUI_ == null)
            this.exportUI_ = ExportUI.instance

        AudioMgr.instance.init()

        if(GameSetting.debug == 1)
            GameStorage.clearAllStorage()

        this.loadData()
        
        if(G.isMinigamePlat)
        {
            if(G.isTMSDK)
            {
                wx.tmSDK.login().then(res=>{
                    console.log('[TMSDK] login', res)

                    GameSetting.openId = res.open_id
                    GameSetting.sessionKey = ''

                    this.bLogined = true
                })

                wx.tmSDK.onShareAppMessage(function(){
                    return {
                        scene: 'forward', // 天幕后台预设分享资料
                        //title: 'xxx', // 可选设置，自定义分享标题，优先级比设置scene中自动设置的title高
                        //imageUrl: 'xxx', // 可选设置，自定义分享标题，优先级比设置scene中自动设置的imageUrl高
                        query: '', // 自行定义传入分享的参数, 可在卡片打开后获取到自己的参数
                    }
                })
            }
            else
            {
                let sucCb = this._loginSucc.bind(this)
                let failCb = this._loginFail.bind(this)
                let errCb = this._loginError.bind(this)

                if(GameSetting.openId && GameSetting.openId != '' && GameSetting.openId != 'null' &&
                    GameSetting.payment === 0)
                {
                    this._loginSucc(null)
                }
                else
                {
                    if(!kUnionID)
                        WxUtil.login(sucCb, failCb, errCb, true)
                }

                //自行填写主动转发的必要参数
                let forwardCb = function() {
                    let msg = DataHub.getMessage

                    return {
                        title: msg.title,
                        imageUrl: msg.img,
                        query: '',
                    }
                }.bind(this)

                WxUtil.showForward(forwardCb)
            }

            //由于来电话或者虚拟按键切后台等原因导致的音频播放被关闭，使用此方法恢复
            wx.onAudioInterruptionEnd(()=>{
                AudioMgr.instance.stopEffects()
                AudioMgr.instance.resumeMusic()
            })
        }
        else
        {
            this.bLogined = true
            HDSDK.init(GameSetting.openId, GameSetting.proName)
        }

        this._onShow()
        this._onHide()
    }

    start () 
    {
        
    }

    log()
    {
        
    }

    loadData()
    {
        this.readData()
        WxUtil.readData()

        GameUserInfo.read()
    }

    saveData()
    {
        let sav = {
            
        }

        GameStorage.writeJSON(SaveDef.kGameData, sav)
    }

    private readData()
    {
        let sav = GameStorage.readJSON(SaveDef.kGameData)
        if(G.isExistObj(sav))
        {
            
        }
        else
        {
            
        }
    }

    get eventManager()
    {
        return this.gameEvtMgr_
    }

    //跳转场景处理，可传入进度回调以及加载后回调
    /**
     * @param scene 要跳转的场景名
     * @param lauchedCb 场景跳转完毕后的回调
     */
    changeScene(scene: string, procCb?: Function, lauchedCb?: Function)
    {
        GameEventMgr.instance.clear()
        TimedTaskMgr.instance.clear()

        let progressCb = function(completedCnt, totalCnt, item) {
            // G.console('changeScene proc', 1, completedCnt, totalCnt)

            if(procCb)
                procCb(completedCnt, totalCnt, item)
        }

        let loadedCb = function(error) {
            if(error)
            {
                cc.log("change scene err", error)
            }
            else
            {
                G.console('changeScene over')

                cc.director.loadScene(scene, lauchedCb)

                cc.sys.garbageCollect()

                if(G.isWeChat)
                    wx.triggerGC()
                else if(G.isBaidu)
                    swan.triggerGC()
                else if(G.isByteDance)
                    tt.triggerGC()
                else if(G.isQuickGame)
                    qg.triggerGC()
            }
		}
        
		cc.director.preloadScene(scene, progressCb, loadedCb)
	}

    recordFPS(bVal: boolean)
    {
        if(bVal)
        {
            this.fpsSum_ = 0
            this.frames_ = 0
        }

        this.bRecDt_ = bVal
    }

    get averageFPS()
    {
        let ret = 0
        if(this.frames_ > 0)
            ret = Math.floor((this.fpsSum_ / this.frames_))
        return ret
    }

    update (dt) 
    {
        if(this.gameEvtMgr_)
            this.gameEvtMgr_.excuteEvents()
        
        if(this.timedTaskMgr_)
            this.timedTaskMgr_.excuteTasks(dt)
        
        if(this.exportUI_)
            this.exportUI_.update(dt)

        if(this.bRecDt_)
        {
            if(dt > 0)
            {
                let f = 1 / dt
                if(f > 60)
                    f = 60
                this.fpsSum_ += f

                // G.log('fps rec', 1 / dt)
            }
            ++this.frames_
        }
    }

    private _loginSucc(res)
    {
        if(res)
        {
            GameSetting.openId = res.openId
            GameSetting.sessionKey = res.sessionKey

            console.log('login succ cb', res)
        }
        else
            console.log('no login succ cb')

        if(GameSetting.openId && GameSetting.openId != '' && GameSetting.openId != 'null' &&
            GameSetting.payment === 0)
        {
            WxUtil.saveData()
        }

        HDSDK.init(GameSetting.openId, GameSetting.proName)

        WxUtil.launchQueryCheck(kUnionID)

        this.bLogined = true

        // HttpRequest.getUserId(GameSetting.openId, '', (dat) => {
        //     if(dat && dat.res)
        //         this.gameId = dat.res
    
        //     console.log('statistic getUserId', this.gameId, dat)
        // })

        // console.log('login succ cb', res)
    }

    private _loginFail(res)
    {
        GameSetting.sessionKey = ''

        this.bLogined = true

        console.log('login fail cb', res)
    }

    private _loginError(res)
    {
        this.bLogined = true
    }

    private _onShow()
    {
        if(G.isMinigamePlat)
        {
            wx.onShow((res)=> {
                    
                AudioMgr.instance.stopEffects()
                AudioMgr.instance.resumeMusic(AudioPauseType.kBackend)

                G.log('onShow')

                let inviteCb = function(res) {
                    G.log('on show invite cb', res)

                }.bind(this)

                WxUtil.onShowQueryCheck(res.query, kUnionID)

                WxUtil.normShareResult()

                cc.director.resume()

                GameUserInfo.calOfflineTime()

                WxUtil.decideBannerClickSuc()

                // console.log('resume')
            })
        }
        else
        {

        }
    }

    private _onHide()
    {
        if(G.isMinigamePlat)
        {
            wx.onHide((res)=> {
                cc.director.pause()
                
                AudioMgr.instance.pauseMusic(AudioPauseType.kBackend)
                AudioMgr.instance.stopEffects()

                WxUtil.bannerStat(res)

                GameUserInfo.setOfflineTimestamp()
                GameUserInfo.saveSignIn()

                // console.log('pause')
            })
        }
        else
        {

        }
    }
}
