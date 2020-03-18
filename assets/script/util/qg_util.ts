import { GameSetting } from "../game_setting";
import { HDMap } from "./structure/hd_map";
import { GameEventMgrInst, EventType } from "./event_mgr";
import { TimedTaskInst } from "./timed_task";
import { DataHub } from "../data/data_hub";
import { G } from "./global_def";
import { BannerSimUI } from "../game_ui/common/ad_sim_ui";
import { BaseUI } from "../game_ui/common/base_ui";

const kTestDomain = 'http://119.23.108.126:8900/comLogin'
const kComLoginDomain = 'https://login.joyfulh.com/comLogin'

export class QgUtil {
    public static sdkInfo = null

    private static domain_ = kComLoginDomain

    //获取系统信息
    public static fetchSdkInfo()
    {
        QgUtil.sdkInfo = qg.getSystemInfoSync()

        console.log('[QgUtil SDK info]', QgUtil.sdkInfo.screenWidth, QgUtil.sdkInfo.screenHeight, 
            QgUtil.sdkInfo.platform, QgUtil.sdkInfo.SDKVersion, QgUtil.sdkInfo.appName)

        if(GameSetting.testServer == 1)
            QgUtil.domain_ = kTestDomain
    }

    public static isCorrectVerCode(targetCode: number)
    {
        return this.sdkInfo && this.sdkInfo.platformVersionCode >= targetCode
    }

    //对比版本号，返回1 代表v1Str大，返回-1 代表v2Str大，返回0则相等
    public static compareVersion(v1Str: String, v2Str: String) 
    {
        let v1 = v1Str.split('.')
        let v2 = v2Str.split('.')
        let len = Math.max(v1.length, v2.length)

        while (v1.length < len) {
            v1.push('0')
        }
        while (v2.length < len) {
            v2.push('0')
        }

        for (let i = 0; i < len; i++) {
            let num1 = parseInt(v1[i])
            let num2 = parseInt(v2[i])

            if (num1 > num2) {
                return 1
            } 
            else if (num1 < num2) {
                return -1
            }
        }

        return 0
    }

    //显示转发按钮并设置回调监听
    static showForward(callback: Function)
    {
        
    }

    /**
     * 创建桌面图标
     */
    static installedShortcut()
    {
        if(QgUtil.isCorrectVerCode(1041))
        {
            qg.hasShortcutInstalled({
                success: (status)=>{
                    if(status)
                    {

                    }
                    else
                    {
                        qg.installShortcut({
                            message: '是否创建桌面图标，以便下次更快捷的进入游戏',
                        })
                    }
                }
            })
        }
    }

    static writeFile(url: string, data: any, encoding = 'utf8', pos = 0)
    {
        if(QgUtil.isCorrectVerCode(1031))
        {
            qg.writeFileSync({
                uri: url,
                text: data,
                encoding: encoding,
                position: pos
            })
        }
    }
    
    //伪分享接口
    /* 常规的分享，目前分享后没有回调，所以采用时间差计算的方式去判断是否分享成功 */
    static normShareTimestamp = 0 //分享后的时间戳
    static normShareSuccCallback = null //分享成功回调
    static normShareFailCallback = null //分享失败回调
    static bNormShareCancel = false

    /**
     * 常规分享
     * @param succCb 分享成功回调 
     * @param cancelCb 取消分享回调
     * @param failCb 分享失败回调
     * @param completeCb 分享结束回调
     */
    static shareNorm(succCb?: Function, cancelCb?: Function, failCb?: Function, completeCb?: Function)
    {
        if(QgUtil.isCorrectVerCode(1055))
        {
            qg.share({
                success: ()=>{
                    if(succCb)
                        succCb()
                },
                fail: (errmsg, errcode)=> {
                    console.log('shareNorm fail', errmsg, errcode)
                    if(failCb)
                        failCb(errmsg, errcode)
                },
                cancel: ()=>{
                    if(cancelCb)
                        cancelCb()
                },
                complete: ()=>{
                    if(completeCb)
                        completeCb()
                }
            })
        }
    }

    //该函数在切回前台的地方调用，用于计算时间差值判断是否分享成功
    static normShareResult()
    {
        
    }

    //游戏切换回前台时的应邀检查
    /**
     * 
     * @param query qg.onShow给到的query值
     * @param inviteCb 应邀后的回调处理，将会传入一个number值到回调函数中，1表示应邀成功，0表示应邀失败
     * @param bUnionID 是否使用unionId接口
     */
    static onShowQueryCheck(query: any)
    {
        
    }

    private static videoBonusCallback_: Function = null

    private static videoAd_ = null
    private static videoTimeId_ = 0

    private static videoAdsProtectFlags_: HDMap = new HDMap()
    private static videoAdsCallbackMap_ = new HDMap()

    private static _getVideoBonus()
    {
        if(QgUtil.videoBonusCallback_)
        {
            // console.log('_getVideoBonus')

            QgUtil.videoBonusCallback_()
            QgUtil.videoBonusCallback_ = null
        }
    }

    //广告观看接口，为了避免频繁点击拉取广告的行为，与updateAdsRequestTimer配合使用，
    //第一次调用后将锁定5秒，请在合适的地方调用updateAdsRequestTimer不断更新计时器，框架默认在GameLogic之中更新
    /**
     * 
     * @param unitID 广告位id，由对应项目的微信后台管理中生成
     * @param closeCbSuc 观看完毕关闭广告的回调处理
     * @param closeCbFail 中断观看关闭广告的回调处理
     * @param errCb 广告拉取报错的回调处理，具体错误码（若要使用需要判断基础库版本号>= 2.2.2）可以查阅微信官方手册
     * @param createCb 调用该函数时会进行的回调处理，比如锁定屏幕或者暂停游戏都可以在此进行
     * @param bonusCb 如果有视频误点，可以传入视屏误点的奖励回调
     * @param bonusTip 广告误点诱导文案，不指定则显示默认文本
     * 
        let closeCbSuc = function() {
            //dosomething
        }

        let closeCbFail = function() {
            //dosomething
        }

        let errCb = function() {
            //dosomething
        }

        let createCb = function() {
            //dosomething
        }

        WxUitl.watchVideoAds('xxxxx', closeCbSuc, closeCbFail, errCb, createCb)
     */
    static watchVideoAds(unitID: string, closeCbSuc?: Function, closeCbFail?: Function, errCb?: Function, createCb?: Function, 
        bonusCb?: Function, bonusTip = '')
    {
        let info = QgUtil.sdkInfo
        // console.log(info.SDKVersion)
        if(QgUtil.isCorrectVerCode(1041))
        {
            let closeCB = function(res: any) {
                if(QgUtil.videoAdsProtectFlags_.containsKey(unitID))
                {
                    let v = QgUtil.videoAdsProtectFlags_.get(unitID)
                    if(v === 1)
                        return
                }

                console.log('Ads Close callback', res.isEnded)

                GameEventMgrInst.addEvent(EventType.kAudioResume, null, { pauseType: 1 })

                if(res && res.isEnded)
                {
                    if(closeCbSuc)
                        closeCbSuc()

                    // WxUtil.commStatAdWatchSucc()

                    QgUtil.videoAdsProtectFlags_.put(unitID, 1)
                }
                else
                {
                    if(closeCbFail)
                        closeCbFail()

                    QgUtil.toast('请观看完整视频以获取奖励')

                    QgUtil.videoAdsProtectFlags_.put(unitID, 0)
                }

                if(QgUtil.videoTimeId_ > 0)
                {
                    // console.log('TimedTaskInst.remove id', WxUtil.videoTimeId_)

                    TimedTaskInst.remove(QgUtil.videoTimeId_)
                    QgUtil.videoTimeId_ = 0
                }

                QgUtil.videoBonusCallback_ = null
            }

            let errorCB = function(res: any) {
                GameEventMgrInst.addEvent(EventType.kAudioResume, null, { pauseType: 1 })

                switch (res.errCode) {
                    case -3:
                        console.log("激励广告加载失败---调用太频繁");
                        QgUtil.toast('暂无合适的广告，请稍后再试', 2)
                        break;
                    case -4:
                        console.log("激励广告加载失败--- 一分钟内不能重复加载");
                        QgUtil.toast('暂无合适的广告，请稍后再试', 2)
                        break;
                    case 30008:
                        // 当前启动来源不支持激励视频广告，请选择其他激励策略
                        QgUtil.toast('暂无合适的广告，请稍后再试', 2)

                        if(errCb)
                            errCb(res)

                        break;
                    default:
                        // 参考 https://minigame.vivo.com.cn/documents/#/lesson/open-ability/ad?id=广告错误码信息 对错误码做分类处理
                        console.log("激励广告展示失败", res.errCode)

                        QgUtil.toast('暂无合适的广告，请稍后再试', 2)

                        if(errCb)
                            errCb(res)
                
                        break;
                }

                QgUtil.videoBonusCallback_ = null
            }

            let loadCB = ()=>{
                console.log('video show')
                GameEventMgrInst.addEvent(EventType.kAudioPause, null, { pauseType: 1 })

                if(G.randRange(0, 100) <= DataHub.config.videoBonus)
                {
                    if(this.videoTimeId_ > 0)
                    {
                        TimedTaskInst.remove(this.videoTimeId_)
                        this.videoTimeId_ = 0
                    }

                    this.videoBonusCallback_ = bonusCb
                    this.videoTimeId_ = TimedTaskInst.add(()=>{
                        let txt = bonusTip || '点击底部条幅可获得奖励'
                        // WxUtil.modalDialog('提示', txt, null, null, false)
                        this.toast(txt, 5000)

                    }, 5)

                    // console.log('TimedTaskInst.add id', this.videoTimeId_)
                }

                let adshow = QgUtil.videoAd_.show();
                // 捕捉show失败的错误
                adshow && adshow.catch(err=>{
                    console.log("激励广告展示失败", err)
                })
            }

            QgUtil.videoAd_ = qg.createRewardedVideoAd({
                posId: unitID
            })

            QgUtil.videoAd_.onClose(closeCB)
            QgUtil.videoAd_.onError(errorCB)
            QgUtil.videoAd_.onLoad(loadCB)
            
            let adLoad = QgUtil.videoAd_.load()
            adLoad && adLoad.catch(err=>{
                console.log("激励广告load失败", err)
            })

            if(QgUtil.videoAdsCallbackMap_.containsKey(unitID))
            {
                let info = QgUtil.videoAdsCallbackMap_.get(unitID) as VideoAdsInfo
                QgUtil.videoAd_.offClose(info.closeCallback)
                QgUtil.videoAd_.offError(info.errCallback)
                QgUtil.videoAd_.offLoad(info.loadCallback)

                QgUtil.videoAdsCallbackMap_.remove(unitID)
            }

            let info = new VideoAdsInfo(closeCB, errorCB, loadCB)
            QgUtil.videoAdsCallbackMap_.put(unitID, info)
            
            if(createCb)
                createCb()
        }
        else
        {
            QgUtil.modalDialog('提示', '微信版本较低，暂不支持视频观看',
                null, null, false)
        }
    }

    static bannerStat(res)
    {
        if(res && res.mode && res.targetAction)
        {
            //not ad
            if(res.mode == 'back' && res.targetAction == 3 ||
                res.mode == 'hide' && res.targetAction == -1)
            {
                return
            }

            // console.log('bannerStat', res)

            //TODO: stat here
            QgUtil._getVideoBonus()
        }
    }

    private static bnrItemMap_ = new HDMap() //key: adunit value: BannerItem
    private static lastBnrItemStack_: BannerItem[] = []

    private static _calBannerXYWZ(width?: number, node?: FGUIObj, posType = 1, offsetY = 15)
    {
        let ret = { x: 0, y: 0, w: 0, h: 0 }

        //Banner 广告 最小宽度是 128（设备像素），最大宽度是 208（设备像素）
        let wid = Math.max(Math.min(width, 208), 128) 
        let hgt = (wid / 16) * 9

        let px = 0
        let py = 0
        if(node)
        {
            let gameHgt = cc.view.getVisibleSize().height
            let posY = node.localToGlobal().y

            let ratio = (posY + offsetY) / gameHgt

            py = QgUtil.sdkInfo.screenHeight * ratio

            console.log('_calBannerXYWZ node', ratio, posY, offsetY, gameHgt - posY, gameHgt, py, QgUtil.sdkInfo.screenHeight)
        }
        else
        {
            px = (QgUtil.sdkInfo.screenWidth - wid) * 0.5
            py = QgUtil.sdkInfo.screenHeight - hgt - 25
            if(posType == 0)
                py = 0

            console.log('_calBannerXYWZ norm', wid, hgt, px, py)
        }

        ret = { x: px, y: py, w: wid, h: hgt }

        return ret
    }

    /**
     * 预加载banner广告
     * @param adunit 广告组件id
     * @param node banner跟随的节点，用于banner需要跟随某些节点位置的情况
     * @param width Banner 广告 最小宽度是 128（设备像素），最大宽度是 208（设备像素）
     * @param offsetY y轴偏移量，跟随节点时，y轴上离节点的偏移距离
     * @param loadCb 广告拉取成功的监听，只有预加载时需要监听是否加载成功，通常加载广告会占用较多运算资源
     * 此时如果做其他网络请求相关的操作可能被阻塞超时，建议在预加载banner时，其他操作等到预加载完成后进行，
     * loadCb和errCb可用于这样的情况
     * @param errCb 广告拉取失败处理
     * @param posType 0 置顶 1 置底，默认置底
     * @param refreshRule 对于单个广告的刷新规则，0~999为展示次数刷新，1000以上为次数到后，
     * 预加载时才刷新（如1003，表示展示3次之后，在预加载时会刷新）
     * @param tag 自定义的banner标签，会和adunit组合起来成为新的缓存id，对于需要同一个adunit创建多个缓存的情况下有用，默认为空
     */
    static preloadBanner(adunit: string, node?: FGUIObj, width = 208, offsetY = 15, 
        loadCb: Function = null, errCb: Function = null, posType = 1, refreshRule = 4, tag = '')
    {
        let id = adunit
        adunit = adunit + tag
        if(!G.isQuickGame)
        {
            BannerSimUI.addTestBannerHolder(adunit, node ? node.asCom : null, posType)
            if(loadCb)
                loadCb()

            return
        }

        if(QgUtil.isCorrectVerCode(1031))
        {
            if(refreshRule > 1000 && QgUtil.bnrItemMap_.containsKey(adunit))
            {
                let item = QgUtil.bnrItemMap_.get(adunit)
                if(item.refreshCnt >= refreshRule)
                    QgUtil.destroyBanner(adunit)
            }

            let item: BannerItem = null
            if(!QgUtil.bnrItemMap_.containsKey(adunit))
            {
                item = new BannerItem()

                let pos = QgUtil._calBannerXYWZ(width, node, posType, offsetY)

                item.obj = qg.createBannerAd({
                    posId: id,
                    style: {
                        left: pos.x,
                        top: pos.y,
                        width: pos.w,
                        // height: pos.h
                    }
                })

                item.id = adunit

                item.refreshCnt = 0
                item.refreshRule = refreshRule
                item.errCb = errCb

                item.x = pos.x
                item.y = pos.y
                item.w = pos.w
                item.h = pos.h

                item.adErrCallback = (res)=>{
                    G.log('Banner Ads pull failed', res)

                    ++item.refreshCnt

                    if(QgUtil.isCorrectVerCode(1031))
                    {
                        if(res.errCode)
                        {
                            if(res.errCode == 1000 || res.errCode == 1003)
                            {

                            }
                            else
                            {
                                item.bLimited = true
                            }
                        }
                    }

                    if(item.errCb)
                        item.errCb()
                }

                item.obj.onError(item.adErrCallback.bind(item))

                let sizeCb = (size)=>{
                    // console.log(size.width, size.height);
                    item.obj.style.top = pos.y
                    item.obj.style.left = (this.sdkInfo.screenWidth - size.width) / 2;

                    item.obj.offSize(sizeCb)
                }

                item.obj.onSize(sizeCb)

                let adLoadCallback = ()=>{
                    G.log('Banner pull success')

                    if(loadCb)
                        loadCb()

                    item.obj.offLoad(adLoadCallback)
                }

                item.obj.onLoad(adLoadCallback)

                QgUtil.bnrItemMap_.put(adunit, item)
            }
        }
    }

    static isBannerShowed(adunit: string, tag = '')
    {
        adunit = adunit + tag
        if(!G.isQuickGame)
        {
            return BannerSimUI.isTestBannerHolderShowed(adunit)
        }

        let bRet = false
        if(QgUtil.bnrItemMap_.containsKey(adunit))
        {
            let item = QgUtil.bnrItemMap_.get(adunit)
            bRet = item.bShow
        }

        return bRet
    }

    static isBannerLimited(adunit: string, tag = '')
    {
        adunit = adunit + tag
        if(!G.isQuickGame)
        {
            return BannerSimUI.isTestBannerLimited(adunit)
        }

        let bRet = false
        if(QgUtil.bnrItemMap_.containsKey(adunit))
        {
            let item = QgUtil.bnrItemMap_.get(adunit)
            bRet = item.bLimited
        }

        return bRet
    }

    static showBanner(adunit: string, tag = '')
    {
        let id = adunit
        adunit = adunit + tag
        if(!G.isQuickGame)
        {
            BannerSimUI.showTestBannerHolder(adunit)

            return
        }

        if(QgUtil.isCorrectVerCode(1031))
        {
            QgUtil.hideLastOne()

            if(QgUtil.bnrItemMap_.containsKey(adunit))
            {
                let item = QgUtil.bnrItemMap_.get(adunit) as BannerItem

                if(item.refreshRule < 1000 && item.refreshCnt >= item.refreshRule)
                {
                    let newItem = new BannerItem()

                    newItem.obj = qg.createBannerAd({
                        adUnitId: id,
                        style: {
                            left: item.x,
                            top: item.y,
                            width: item.w,
                            // height: item.h
                        }
                    })

                    newItem.id = adunit

                    newItem.refreshCnt = 0
                    newItem.refreshRule = item.refreshRule

                    newItem.errCb = item.errCb

                    newItem.adErrCallback = (res)=>{
                        G.log('Banner Ads pull failed', res)
    
                        ++newItem.refreshCnt

                        if(QgUtil.isCorrectVerCode(1031))
                        {
                            if(res.errCode)
                            {
                                if(res.errCode == 1000 || res.errCode == 1003)
                                {

                                }
                                else
                                {
                                    newItem.bLimited = true
                                }
                            }
                        }
    
                        if(newItem.errCb)
                            newItem.errCb()
                    }

                    newItem.obj.onError(newItem.adErrCallback.bind(newItem))

                    let sizeCb = (size)=>{
                        console.log(size.width, size.height);
                        item.obj.style.top = item.y
                        item.obj.style.left = (this.sdkInfo.screenWidth - size.width) / 2;
    
                        item.obj.offSize(sizeCb)
                    }
    
                    item.obj.onSize(sizeCb)

                    newItem.x = item.x
                    newItem.y = item.y
                    newItem.w = item.w
                    newItem.h = item.h

                    item.del()

                    QgUtil.bnrItemMap_.remove(adunit)
                    QgUtil.bnrItemMap_.put(adunit, newItem)

                    item = newItem
                }

                item.show()

                QgUtil.lastBnrItemStack_.push(item)
            }
        }
    }

    static hideBanner(adunit: string, tag = '')
    {
        adunit = adunit + tag
        if(!G.isQuickGame)
        {
            BannerSimUI.hideTestBannerHolder(adunit)

            return
        }

        if(QgUtil.bnrItemMap_.containsKey(adunit))
        {
            let item = QgUtil.bnrItemMap_.get(adunit)
            item.hide()

            QgUtil.lastBnrItemStack_.pop()
            if(QgUtil.lastBnrItemStack_.length > 0)
            {
                QgUtil.lastBnrItemStack_[QgUtil.lastBnrItemStack_.length - 1].show()
            }
        }
    }

    static showLastOne()
    {   
        if(!G.isQuickGame)
        {
            BannerSimUI.showLastTestBanner()
            return
        }

        if(QgUtil.lastBnrItemStack_.length > 0)
        {
            QgUtil.lastBnrItemStack_[QgUtil.lastBnrItemStack_.length - 1].show()
        }
    }

    static hideLastOne()
    {
        if(!G.isQuickGame)
        {
            BannerSimUI.hideLastTestBanner()
            return
        }

        if(QgUtil.lastBnrItemStack_.length > 0)
        {
            QgUtil.lastBnrItemStack_[QgUtil.lastBnrItemStack_.length - 1].hide()
        }
    }

    static destroyBanner(adunit: string, tag = '')
    {
        adunit = adunit + tag
        if(QgUtil.bnrItemMap_.containsKey(adunit))
        {
            let item = QgUtil.bnrItemMap_.get(adunit) as BannerItem
            item.del()

            for(let i = 0; i < QgUtil.lastBnrItemStack_.length; ++i)
            {
                if(QgUtil.lastBnrItemStack_[i].id === adunit)
                {
                    QgUtil.lastBnrItemStack_.splice(i, 1)
                    break
                }
            }

            QgUtil.bnrItemMap_.remove(adunit)
        }
    }

    static hideAllBanners()
    {
        if(!G.isQuickGame)
        {
            BannerSimUI.hideAllTestBanner()
            return
        }

        QgUtil.hideLastOne()

        QgUtil.bnrItemMap_.each((i, k, v)=>{
            this.hideBanner(k)
        })
    }

    static createInterstitialAd(id: string)
    {
        if(QgUtil.isCorrectVerCode(1031))
        {
            let ad = qg.createInsertAd({ posId: id })

            if(ad)
            {
                ad.show().then(()=>{
                    console.log("interstitial ad show")
                }).catch((err)=>{
                    console.log("interstitial ad failed", err.code)
                })
            }
        }
    }

    private static nativeAdMap_ = new HDMap()
    // private static lastNativeAdStack_: NativeBnrItem[] = []

    /**
     * 创建原生广告对象
     * @param adunit 广告组件id
     * @param node banner跟随的节点，用于banner需要跟随某些节点位置的情况
     * @param width banner宽度，根据设计分辨率自行定义
     * @param height banner高度，根据设计分辨率自行定义
     * @param offsetY y轴偏移量，跟随节点时，y轴上离节点的偏移距离
     * @param errCb 广告拉取失败处理
     */
    static preloadNativeAd(adunit: string, node?: FGUIObj, width = 720, height = 288, offsetY = 25, 
        errCb: Function = null)
    {
        if(!G.isQuickGame)
        {
            BannerSimUI.addTestBannerHolder(adunit, node ? node.asCom : null)

            return
        }

        if(QgUtil.isCorrectVerCode(1053))
        {
            G.log('preloadNativeAd', adunit)

            let x = (cc.view.getVisibleSize().width - width) * 0.5
            let y = node ? node.localToGlobal().y + offsetY : cc.view.getVisibleSize().height - height - 20
            let item = new NativeBnrItem(adunit, x, y, width, height)

            item.load(null, errCb)
            
            this.nativeAdMap_.put(adunit, item)
        }
    }

    /**
     *  展示原生广告
     * @param adunit 广告id
     * @param x 展示位置x，左上角
     * @param y 展示位置y，左上角
     * @param bRefresh 本次展示是否会自动刷新（展示3次无点击会自动刷新一个新的banner）
     */
    static showNativeAd(adunit: string, x?: number, y?: number, bRefresh = true)
    {
        if(!G.isQuickGame)
        {
            BannerSimUI.showTestBannerHolder(adunit)

            return
        }

        if(QgUtil.nativeAdMap_.containsKey(adunit))
        {
            let item = this.nativeAdMap_.get(adunit) as NativeBnrItem
            item.show(x, y, bRefresh)

            // this.lastNativeAdStack_.push(item)
        }
    }

    static hideNativeAd(adunit: string)
    {
        if(!G.isQuickGame)
        {
            BannerSimUI.hideTestBannerHolder(adunit)

            return
        }

        if(QgUtil.nativeAdMap_.containsKey(adunit))
        {
            let item = QgUtil.nativeAdMap_.get(adunit)
            item.hide()

            // QgUtil.lastNativeAdStack_.pop()
            // if(QgUtil.lastNativeAdStack_.length > 0)
            // {
            //     QgUtil.lastNativeAdStack_[QgUtil.lastNativeAdStack_.length - 1].show()
            // }
        }
    }

    // static showLastNativeAd()
    // {   
    //     if(!G.isQuickGame)
    //     {
    //         BannerSimUI.showLastTestBanner()
    //         return
    //     }

    //     if(QgUtil.lastNativeAdStack_.length > 0)
    //     {
    //         QgUtil.lastNativeAdStack_[QgUtil.lastNativeAdStack_.length - 1].show()
    //     }
    // }

    // static hideLastNativeAd()
    // {
    //     if(!G.isQuickGame)
    //     {
    //         BannerSimUI.hideLastTestBanner()
    //         return
    //     }

    //     if(QgUtil.lastNativeAdStack_.length > 0)
    //     {
    //         QgUtil.lastNativeAdStack_[QgUtil.lastNativeAdStack_.length - 1].hide()
    //     }
    // }

    static hideAllNativeAd()
    {
        if(!G.isQuickGame)
        {
            BannerSimUI.hideAllTestBanner()
            return
        }

        QgUtil.hideAllNativeAd()

        QgUtil.nativeAdMap_.each((i, k, v)=>{
            this.hideNativeAd(k)
        })
    }

    //检查是否有新版本，建议使用，保障强制更新，避免版本差异造成的问题
    /**
        let cbUpdate = function() {
            //dosomething while updating,such as process anim
        }

        let cbNoUpdate = function() {
            //dosometiong if there's no update,such as game enter
        }

        WxUtil.checkVersionUpdate(cbUpdat, cbNoUpdate)
     */
    static checkVersionUpdate(cbUpdate: Function, cbNoUpdate: Function)
    {
        qg.onUpdateReady((res)=> {
            if(res == 1)
            {
                QgUtil.modalDialog('更新提示', '新版本已经准备好，请重启游戏', function() {
                    qg.applyUpdate()
                }, null, false)
            }
            else
            {

            }
        })
    }

    //模态窗口，通常用在与微信接口相关的地方，考虑到与游戏风格的一体性，可以将调用此接口的地方更换为游戏中的通用对话框
    static modalDialog(head: string, text: string, confirmCb?: Function, cancelCb?: Function, 
        bDoubleBtn = true)
    {
        qg.showDialog({
            title: head,
            message: text,

            buttons: bDoubleBtn ? [
                { text: '确定', color: '#33dd44' },
                { text: '取消', color: '#000000' }
            ] : [ 
                { text: '确定', color: '#33dd44' },
            ],
            
            success: function (data) {
                console.log('handling callback')
                if(confirmCb)
                    confirmCb()
            },
            cancel: function () {
                console.log('handling cancel')
                if(cancelCb)
                    cancelCb()
            },
        })
    }

    static toast(text: string, dura = 1500)
    {
        qg.showToast({ message: text, duration: dura })
    }

    //使手机发生较短时间的振动（15 ms）。仅在 iPhone 7 / 7 Plus 以上及 Android 机型生效
    static vibrateShort()
    {
        qg.vibrateShort()
    }

    //使手机发生较长时间的振动（400 ms)
    static vibrateLong()
    {
        qg.vibrateLong()
    }

    //默认的更多游戏跳转列表，如果不传入跳转启动参数，则读取此默认列表中的
    // private static defaultLaunchOptions_ = [
    //     //可按如下格式填写跳转列表，其中query和extraData为可选参数
    //     // { appId: "ttXXXXXX", query: "foo=bar&baz=qux", extraData: {} }
    //     { appId: "tt90b7e60a0f9d5a88" },
    //     { appId: "tte77191cc785b3fdb" },
    //     { appId: "tt826ff4d21d455943" },
    //     { appId: "tt3f5449e9a07efb4d" },
    //     { appId: "tt1794612988becef1" },
    //     { appId: "tt4eff3842d1d593ee" },
    //     { appId: "tt1b5e6de38474d516" },
    //     { appId: "tt5327259acc0d91e5" },
    //     { appId: "ttb698c02529b27ff9" },
    //     { appId: "tt34f44249abde15c0" },
    // ]

    // private static bListenMGModalClose_ = false

    // /**
    //  * 弹出更多游戏对话框
    //  * @param lauchOpt 小游戏启动参数选项，不填写则使用defaultLaunchOptions_中的进行填充
    //  * @param sucCb 跳转成功后的回调，可选参数
    //  * @param failCb 取消跳转或跳转失败后的回调，可选参数
    //  * @param closeCb 关闭更多游戏界面的回调
    //  */
    // static popMoreGamesDialog(lauchOpt?: any[], sucCb?: Function, failCb?: Function, closeCb?: Function)
    // {
    //     let info = QgUtil.sdkInfo
    //     if(info.platform !== "ios")
    //     {
    //         if(QgUtil.compareVersionForWx(info.SDKVersion, '1.33.0') !== -1)
    //         {
    //             let opt = lauchOpt || QgUtil.defaultLaunchOptions_
    //             qg.showMoreGamesModal({
    //                 appLaunchOptions: opt,
    //             })

    //             if(!QgUtil.bListenMGModalClose_)
    //             {
    //                 // 监听弹窗关闭
    //                 qg.onMoreGamesModalClose(function() {
    //                     if(closeCb)
    //                         closeCb()
    //                 })

    //                 QgUtil.bListenMGModalClose_ = true
    //             }

    //             qg.offNavigateToMiniProgram()

    //             // 监听小游戏跳转
    //             qg.onNavigateToMiniProgram((res)=> {
    //                 // console.log(res.errCode)
    //                 // console.log(res.errMsg)
    //                 // console.log(res.from)

    //                 if(res.errCode === 0)
    //                 {
    //                     if(sucCb)
    //                         sucCb()
    //                 }
    //                 else
    //                 {
    //                     if(failCb)
    //                         failCb()
    //                 }
    //             })
    //         }
    //     }
    // }

    // private static moreGameBtn_: MoreGamesButton = null

    // /**
    //  * 创建更多游戏按钮，目前在皮皮虾中不存在这个接口，在西瓜视频中可能显示不出来图片，故采用文本模式
    //  * @param x 按钮x坐标（设计分辨率下的）
    //  * @param y 按钮y坐标（设计分辨率下的）
    //  * @param w 按钮宽（设计分辨率下的）
    //  * @param h 按钮高（设计分辨率下的）
    //  * @param imgPath 按钮图片本地路径，只有在type为0时有效
    //  * @param txt 按钮的文本，只有在type为1时有效
    //  * @param lauchOpt 小游戏启动参数选项，不填写则使用defaultLaunchOptions_中的进行填充
    //  * @param succCb 跳转成功后的回调，可选参数
    //  * @param failCb 取消跳转或跳转失败后的回调，可选参数
    //  * @param onClick 点击了更多游戏按钮的回调
    //  * @param type 按钮类型，0为图片 1为文本，默认为0
    //  */
    // static createMoreGamesButton(x: number, y: number, w: number, h: number, imgPath?: string, txt?: string, 
    //     lauchOpt?: any[], succCb?: Function, failCb?: Function, onClick?: Function, type = 0)
    // {
    //     if(!QgUtil.moreGameBtn_)
    //     {
    //         let info = QgUtil.sdkInfo
    //         if(info.appName !== kPortPPX && info.platform !== "ios" && 
    //             QgUtil.compareVersionForWx(info.SDKVersion, '1.23.0') !== -1)
    //         {
    //             let bVert = Laya.stage.height > Laya.stage.width

    //             let sclX = info.screenWidth / Laya.stage.width
    //             let sclY = info.screenHeight / Laya.stage.height

    //             let scl = bVert ? sclX : sclY

    //             let px = x * sclX
    //             let py = y * sclY
    //             let aw = w * scl
    //             let ah = h * scl

    //             console.log('createMoreGamesButton', x, y, w, h, px, py, aw, ah, scl, sclX, sclY)

    //             let borderWid = 0
    //             let borderRad = 0
    //             if(info.appName === kPortXiGua)
    //             {
    //                 type = 1
    //                 txt = '更多游戏'
    //                 borderWid = 2
    //                 borderRad = 10
    //             }

    //             QgUtil.moreGameBtn_ = qg.createMoreGamesButton({
    //                 type: type === 0 ? "image" : "text",
    //                 image: imgPath,
    //                 text: txt,
    //                 style: {
    //                     left: px,
    //                     top: py,
    //                     width: aw,
    //                     height: ah,
    //                     lineHeight: 24,
    //                     backgroundColor: "#e5e4f1",
    //                     textColor: "#413f59",
    //                     textAlign: "center",
    //                     fontSize: 20,
    //                     borderRadius: borderRad,
    //                     borderWidth: borderWid,
    //                     borderColor: "#413f59"
    //                 },

    //                 appLaunchOptions: lauchOpt || QgUtil.defaultLaunchOptions_,

    //                 onNavigateToMiniGame(res) {
    //                     // console.log("跳转其他小游戏", res);

    //                     if(res.errCode === 0)
    //                     {
    //                         if(succCb)
    //                             succCb()
    //                     }
    //                     else
    //                     {
    //                         if(failCb)
    //                             failCb()
    //                     }
    //                 }
    //             })

    //             QgUtil.moreGameBtn_.onTap(onClick)

    //             QgUtil.moreGameBtn_.hide()
    //         }
    //     }
    // }

    // static showMoreGamesButton()
    // {
    //     if(QgUtil.moreGameBtn_)
    //     {
    //         QgUtil.moreGameBtn_.show()
    //     }
    // }

    // static hideMoreGamesButton()
    // {
    //     if(QgUtil.moreGameBtn_)
    //     {
    //         QgUtil.moreGameBtn_.hide()
    //     }
    // }

    private static audioInfoMap_ = new HDMap() //key: path value:AudioInfo

    /**
     * 音频播放
     * @param path 音频资源的地址
     * @param bLoop 是否循环播放，默认为 false
     * @param volume 音量。范围 0~1。默认为 1
     * @param bAuto 是否自动开始播放，默认为 false
     */
    static playAudio(path: string, bLoop = false, volume = 1)
    {
        let info: AudioInfo = null
        if(QgUtil.audioInfoMap_.containsKey(path))
        {
            info = QgUtil.audioInfoMap_.get(path)
        }
        else
        {
            info = new AudioInfo(path)

            QgUtil.audioInfoMap_.put(path, info)
        }

        if(info)
        {
            let audio = info.obj
            if(audio)
            {
                audio.src = path
                audio.volume = volume
                audio.loop = bLoop

                audio.play()
            }
        }
    }

    static addAudioCallback(path: string, endCb?: Function)
    {
        if(QgUtil.audioInfoMap_.containsKey(path))
        {
            let info = QgUtil.audioInfoMap_.get(path) as AudioInfo
            if(info.endCallback)
                info.obj.offEnded(info.endCallback)

            info.endCallback = endCb

            info.obj.onEnded(info.endCallback)
        }
    }

    //恢复音频播放
    static resumeAudio(path: string)
    {
        if(QgUtil.audioInfoMap_.containsKey(path))
        {
            let info = QgUtil.audioInfoMap_.get(path)
            info.obj.play()
        }
    }

    //暂停音频播放
    static pauseAudio(path: string)
    {
        if(QgUtil.audioInfoMap_.containsKey(path))
        {
            let info = QgUtil.audioInfoMap_.get(path)
            info.obj.pause()
        }
    }

    //停止播放
    static stopAudio(path: string)
    {
        if(QgUtil.audioInfoMap_.containsKey(path))
        {
            let info = QgUtil.audioInfoMap_.get(path)
            info.obj.stop()
        }
    }

    //销毁不再需要的音频实例
    static destroyAudio(path: string)
    {
        if(QgUtil.audioInfoMap_.containsKey(path))
        {
            let info = QgUtil.audioInfoMap_.get(path)
            if(info.endCallback)
                info.obj.offEnded(info.endCallback)
                
            info.obj.destroy()

            QgUtil.audioInfoMap_.remove(path)
        }
    }
}

class AudioInfo {   
    obj: QgInnerAudioContext = null
    endCallback: Function = null

    constructor(path: string)
    {
        this.obj = qg.createInnerAudioContext()
    }
}

class VideoAdsInfo {
    closeCallback: Function = null
    errCallback: Function = null
    loadCallback: Function = null

    constructor(closeCb: Function, errCb: Function, loadCb: Function)
    {
        this.closeCallback = closeCb
        this.errCallback = errCb
        this.loadCallback = loadCb
    }
}

class BannerItem {
    id = ''

    obj: QgBannerAd = null

    errCb: Function = null

    adErrCallback: Function = null

    refreshRule = 4
    refreshCnt = 0

    x = 0
    y = 0
    w = 0
    h = 0

    bShow = false
    bLimited = false

    show()
    {
        if(this.obj)
        {
            ++this.refreshCnt

            this.obj.show()
                .then((val)=>{ console.log('banner show', this.id) })
                .catch((err)=>{ 
                    console.log('banner show err', err) 
                    ++this.refreshCnt
                })

            this.bShow = true
        }
    }

    hide()
    {
        if(this.obj)
        {
            this.obj.hide()

            this.bShow = false
        }
    }

    del()
    {
        if(this.obj)
        {
            if(this.adErrCallback)
            {
                this.obj.offError(this.adErrCallback)
                this.adErrCallback = null
            }

            this.obj.destroy()
        }
    }
}

const kMaxNativeAdShowCnt = 3

class NativeBnrItem {
    static adList: QgNativeAdItem[] = []

    private id_ = ''

    private obj_: any = null //native banner object

    private currAd_: QgNativeAdItem = null

    private errCb_: Function = null

    private holder_: FGUICom = null //banner loader 需要使用到FGUIProj下，CommUI包中的BnrTestHolder
    private imgLdr_: FGUILoader = null
    // private markLdr_: FGUILoader = null

    private showCnt_ = 0 //3次展示都未点击过，就拉取新数据

    private x_ = 0
    private y_ = 0

    private bLoadToShow = false

    constructor(adId: string, x: number, y: number, w: number, h: number)
    {
        this.id_ = adId

        this.obj_ = qg.createNativeAd({ posId: adId })
        
        this.obj_.onLoad(this._onLoaded.bind(this))

        let com = fairygui.UIPackage.createObject('CommUI', 'BnrTestHolder')
        if(com)
        {
            G.log('[NativeBnrItem] create holder succ')

            this.holder_ = com.asCom
            this.holder_.setPosition(x, y)
            this.holder_.setSize(w, h)

            this.x_ = x
            this.y_ = y

            let bg = this.holder_.getChild('bg').asCom
            bg.visible = false

            this.imgLdr_ = this.holder_.getChild('imgLdr').asLoader
            // this.markLdr_ = this.holder_.getChild('markLdr').asLoader
        }
        else
            G.log('[NativeBnrItem] create holder failed')
    }

    load(loadCb?: Function, errCb?: Function)
    {
        G.log('native load obj', this.obj_)
        if(this.obj_)
        {
            this.errCb_ = errCb

            let adLoad = this.obj_.load()
            adLoad && adLoad.then((res) => {
                G.log('[NativeBnrItem] load succ', res)

                if(loadCb)
                    loadCb()

            }).catch(err => {
                G.log('[NativeBnrItem] load failed', err)

                if(this.errCb_)
                    this.errCb_()

                if(this.bLoadToShow)
                {
                    G.log('[NativeBnrItem] show old one')
                    this._show(this.currAd_)
                }

                // this.bLoadToShow = false
            })
        }
    }

    show(x?: number, y?: number, bRefresh = true)
    {
        if(x)
            this.x_ = x

        if(y)
            this.y_ = y

        this.holder_.visible = true

        if(!this.holder_.parent)
            BaseUI.root.addChild(this.holder_)

        this.holder_.onClick(this._onClick, this)

        if(!this.currAd_ && NativeBnrItem.adList.length > 0)
            this.currAd_ = NativeBnrItem.adList.shift()

        if(this.currAd_ && this.showCnt_ <= kMaxNativeAdShowCnt && !bRefresh)
        {
            this._show(this.currAd_)
        }
        else
        {
            this.bLoadToShow = true
            this.showCnt_ = 0

            this.load()
        }
    }

    hide()
    {
        G.log('[NativeBnrItem] hide')

        this.holder_.visible = false

        this.holder_.offClick(this._onClick, this)

        this.holder_.removeFromParent()
    }

    private _show(ad: QgNativeAdItem)
    {
        if(ad)
        {
            ++this.showCnt_

            this.holder_.setPosition(this.x_, this.y_)

            let url = ad.imgUrlList[0]
            if(url)
            {
                G.log('[NativeBnrItem] show', url, this.x_, this.y_)
                this.imgLdr_.url = url
            }

            // this.markLdr_.url = ad.logoUrl

            this.obj_.reportAdShow({ adId: ad.adId.toString() })
        }
    }

    private _onLoaded(res)
    {
        if(res && res.adList)
        {
            let ad = res.adList.pop()
            if(ad)
            {
                if(this.bLoadToShow)
                {
                    this.currAd_ = ad
                    this._show(ad)
                    this.bLoadToShow = false
                }
                else
                    NativeBnrItem.adList.push(ad)

                G.log('[NativeBnrItem] load new ad', this.bLoadToShow, ad)
            }
        }
    }

    private _onClick()
    {
        if(this.currAd_)
        {
            G.log('[NativeBnrItem] _onClick', this.currAd_)
            
            this.obj_.reportAdClick({ adId: this.currAd_.adId.toString() })

            this.currAd_ = null
            this.showCnt_ = 0

            this.load()
        }
    }
}