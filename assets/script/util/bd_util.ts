
import { G } from "./global_def";
import { AudioMgr } from "./audio_mgr";
import { HDMap } from "./structure/hd_map";
import { HttpRequest } from "./network/http_req";
import { GameSetting } from "../game_setting";
import { GameStorage, SaveDef } from "./game_storage";
import { WxUtil } from "./wx_util";

const kTestDomain = 'http://119.23.108.126:8900/comLogin'
const kComLoginDomain = 'https://login.joyfulh.com/comLogin'

export class BdUtil {
    public static sdkInfo = null

    private static domain_ = kComLoginDomain

    private static adSid_ = 'dfc8260c' //用户自行配置，用于banner与视频广告的拉取

    static saveWxData()
    {
        let sav = {
            openId: GameSetting.openId,
        }
        GameStorage.writeJSON(SaveDef.kWxStatus, sav)
    }

    static readWxData()
    {
        let sav = GameStorage.readJSON(SaveDef.kWxStatus)
        if(sav)
        {
            GameSetting.openId = sav.openId
        }
    }

    //获取系统信息
    public static fetchSdkInfo()
    {
        this.sdkInfo = swan.getSystemInfoSync()

        if(GameSetting.testServer == 1)
            this.domain_ = kTestDomain
    }

    //对比百度基础库版本号，返回1 代表v1Str大，返回-1 代表v2Str大，返回0则相等
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

    //静默登录
    /**
     * 
     * @param succCb 登录成功后请求sessionKey成功的回调，成功后服务端将返回openId和sessionKey，格式data.res = { openId = 'xxx', sessionKey = 'xxx' }
     * @param failCb 登录成功后请求sessionKey失败的回调，一般不需要
     * @param bForceLogin 因为登录态会保持一段时间，检查到会话存在就不会执行登录操作，如果需要强制重登，请将此标志位置为true
     * @param bUnionID 当需要获取unionID时，登录仅仅只请求到会话code即可，不再进行获取sessionKey的操作
     * 
        let succCb = function() {
            
        }

        BdUtil.login(succCb, null, true)
     */
    static login(succCb?: Function, failCb?: Function, bForceLogin = false, bUnionID = false)
    {
        if(bForceLogin)
        {
            this._login(succCb, failCb, bUnionID)
        }
        else
        {
            swan.checkSession({
                success: (sessionRes: any) => {
                    console.log('check session succ', sessionRes)

                    WxUtil.readData()
                },
                fail: (sessionRes: any) => {
                    console.log('check session fail', sessionRes)

                    this._login(succCb, failCb, bUnionID)
                },
                complete: (sessionRes: any) => {

                }
            })
        }
    }

    private static loginCode = ''

    private static _login(succCb?: Function, failCb?: Function, bUnionID = false)
    {
        swan.login({
            success: (loginRes: any) => {
                G.log('login succ', loginRes, bUnionID)
                if(loginRes.code)
                {
                    this.loginCode = loginRes.code

                    if(!bUnionID)
                    {
                        swan.request({
                            url: this.domain_ + '/user/getSessionKey/bd',
                            data: {
                                code: loginRes.code,
                                proName: GameSetting.proName,
                                choose: '1',
                            },
                            header: {
                                'content-type': 'application/json'
                            },
                            method: 'GET',
                            dataType: 'json',
                            success: (res: any) => {
                                if(res.statusCode >= 200 && res.statusCode <= 400)
                                {
                                    console.log('login request succ', res)

                                    if(succCb)
                                        succCb(JSON.parse(res.data.res))
                                }
                                else
                                {
                                    console.log('login request fail', res)

                                    if(failCb)
                                        failCb(res)
                                }
                            },
                            fail: (res: any) => {
                                console.log('login request complete fail', res)
                            },
                        })
                    }
                    else
                    {
                        if(succCb)
                            succCb()
                    }
                }
            },
            fail: (loginRes: any) => {
                console.log('login fail', loginRes)
            },
            complete: (loginRes: any) => {

            }
        })
    }

    //获取用户信息，包括敏感数据
    /**
     * 
     * @param imgUrl 登录鉴权按钮的图片路径，第一次需要提醒用户进行鉴权，会用到该路径，
     * 本地图片存放到如下目录 \build-templates\wechatgame\res\raw-assets\resources
     * @param commCb 通用信息回调，获取到通用信息时进行回调，这些信息不包含unionid一类的敏感信息，具体可以查阅百度接口
     * https://developers.weixin.qq.com/minigame/dev/document/open-api/user-info/UserInfo.html
     * @param reqSucCb 敏感信息获取成功回调，unionid由此获取，openId以及sessionKey也在此处获取
     * @param reqFailCb 敏感信息获取失败回调，进行相应的处理
     * @param tapCb 鉴权按钮点击事件回调，在点击时进行调用，用于处理相应的一些游戏逻辑
     * @param btnStyle 按钮样式，可以自定义位置，默认处于屏幕中央
     * 
        let commCb = function(usrInfo) {
            G.console(usrInfo)
        }

        let sucCb = function(res) {
            GameSetting.unionId = res.unionId
            GameSetting.openId = res.openId
            GameLogic.instance.sessionKey = res.sessionKey
        }

        let tapCb = function() {
            //dosomething
        }

        BdUtil.fetchUserInfo('UI/AutoBtn', commCb, sucCb, null, tapCb)

     */
    static fetchUserInfo(imgUrl: string, commCb?: Function, reqSucCb?: Function, reqFailCb?: Function, 
        tapCb?: Function, btnStyle?: any)
    {
        swan.getSetting({
            success: (res: any) => {
                if(res.authSetting['scope.userInfo'])
                {
                    swan.getUserInfo({
                        withCredentials: true,
                        lang: 'zh_CN',
                        success: (userRes: any) => {
                            if(commCb)
                                commCb(userRes.userInfo)

                            this._authLogin(userRes, reqSucCb, reqFailCb)
                        },

                        fail: (res: any) => {
                            G.log('get setting scope userInfo failed', res)
                        },

                        complete: (res: any) => {

                        },
                    })
                }
                else
                {
                    // if(BdUtil.compareVersion(this.sdkInfo.SDKVersion, '2.0.1') != -1)
                    {
                        let image = swan.createImage();
                        image.src = 'res/raw-assets/resources/' + imgUrl + '.png'
                        image.onload = function() {
                            let style = btnStyle
                            if(G.isEmptyObj(style))
                            {
                                let wid = image.width
                                let hgt = image.height

                                style = {
                                    left: this.sdkInfo.screenWidth * 0.5 - wid * 0.5,
                                    top: this.sdkInfo.screenHeight * 0.5,
                                    width: wid,
                                    height: hgt,
                                    color: '#ffffff',
                                    lineHeight: 40,
                                    backgroundColor: '#ff0000',
                                    borderColor: '#ffffff',
                                    textAlign: 'center',
                                    fontSize: 16,
                                    borderRadius: 4,
                                }
                            }

                            this._authentication(commCb, style, image.src, tapCb, reqSucCb, reqFailCb)

                        }.bind(this)
                    }
                    // else
                    // {
                    //     BdUtil.modalDialog('百度更新提示', '当前百度应用版本较低，建议升级以保障游戏体验',
                    //         function() {
                    //             swan.exitMiniProgram({})
                    //     }, null, false)
                    // }
                }
            },

            fail: (res: any) => {

            },

            complete: (res: any) => {

            }
        })
    }

    private static _authLogin(encryptInfo, sucCb?: Function, failCb?: Function)
    {
        swan.request({
            url: this.domain_ + '/user/auth',
            data : {
                encryptedData : encryptInfo.encryptedData,
                iv : encryptInfo.iv,
                code : this.loginCode,
                proName: GameSetting.proName
            },
            header: {
                'content-type': 'application/json'
            },
            method: 'GET',
            dataType: 'json',
            success: (res: any) => {
                if(res.statusCode >= 200 && res.statusCode <= 400)
                {
                    console.log('_authLogin request succ', res)

                    if(sucCb)
                        sucCb(res.data.res)
                }
                else
                {
                    console.log('_authLogin request fail', res)

                    if(failCb)
                        failCb()
                }
            },
            fail: (res: any) => {
                console.log('_authLogin request complete fail', res)
            },
        })
    }

    private static _authentication(commInfoCb: Function, style: any, imgUrl: string,
        tapCb?: Function, sucCb?: Function, failCb?: Function)
    {
        let btn = swan.createUserInfoButton({
            type: 'image',
            text: 'txt',
            image: imgUrl,
            style: style,
            withCredentials: true,
            lang: 'zh_CN',
        })

        btn.show()

        G.log('create button', btn)

        let tpCb = function(res) {
            G.log('_authentication onTap', res)

            if(res.iv == null || res.encryptedData == null)
            {
                G.log('cancel auth')

                let image = swan.createImage();
                image.src = imgUrl
                image.onload = function() {
                    let st = style
                    if(G.isEmptyObj(st))
                    {
                        let wid = image.width
                        let hgt = image.height

                        st = {
                            left: this.sdkInfo.screenWidth * 0.5 - wid * 0.5,
                            top: this.sdkInfo.screenHeight * 0.5,
                            width: wid,
                            height: hgt,
                            color: '#ffffff',
                            lineHeight: 40,
                            backgroundColor: '#ff0000',
                            borderColor: '#ffffff',
                            textAlign: 'center',
                            fontSize: 16,
                            borderRadius: 4,
                        }
                    }

                    this._authentication(commInfoCb, style, image.src, tapCb, sucCb, failCb)

                }.bind(this)
            }
            else
            {
                if(commInfoCb)
                    commInfoCb(res.userInfo)

                this._authLogin(res, sucCb, failCb)

                if(tapCb)
                    tapCb()
            }

            btn.offTap(tpCb)
            btn.destroy()
        }.bind(this)

        btn.onTap(tpCb)
    }

    // 上报用户信息，当不需要登录自己服务时，可以考虑调用此接口上报获取到的用户信息，以便在某些邀请功能时服务端可以获取到应邀人的信息
    /**
     * 
     * @param nickName 昵称
     * @param avatar 用户头像
     * @param gender 性别
     * @param city 城市
     * @param province 省份
     * @param country 国家
     */
    static uploadUserInfo(nickName: string, avatar: string, gender: string, city: string, province: string, country: string)
    {
        swan.request({
            url: this.domain_ + '/user/updUser',
            data : {
                proName: GameSetting.proName,
                openid: GameSetting.openId,
                unionid: GameSetting.unionId,
                nickname: nickName,
                gender: gender,
                avatarurl: avatar,
                city: city,
                province: province,
                country: country,
            },
            header: {
                'content-type': 'application/json'
            },
            method: 'GET',
            dataType: 'json',
            success: (res: any) => {

            },
            fail: (res: any) => {
                
            },
        })
    }

    //显示转发按钮并设置回调监听
    /*
        let cb = function() {
            return {
                title: 'xx',
                imageUrl: 'xxx',
                query: 'xx'
            }
        }

        BdUtil.showForward(cb)
    */ 
    static showForward(callback: Function)
    {
        swan.showShareMenu({
            withShareTicket: false,
            success: (res: any) => {

            },
            fail: () => {

            },
            complete: () =>
            {
                
            },
        })

        swan.onShareAppMessage(function() {
            let ret = null
            if(callback)
                ret = callback()

            return ret
        })
    }
    
    //伪分享接口
    /* 常规的分享，目前分享后没有回调，所以采用时间差计算的方式去判断是否分享成功 */
    static normShareTimestamp = 0 //分享后的时间戳
    static normShareSuccCallback = null //分享成功回调
    static normShareFailCallback = null //分享失败回调
    static bNormShareCancel = false

    /**
     * 
     * @param title 分享标题
     * @param imageUrl 分享卡片图片
     * @param succCb 假设分享成功后的回调
     * @param failCb 假设分享失败后的回调
     */
    static shareNorm(title: string, imageUrl: string, succCb?: Function, failCb?: Function)
    {
        swan.shareAppMessage({
            title: title,
            imageUrl: imageUrl,
            query: 'snk=1&gid=' + GameSetting.gameId,
            cancel: () => {
                console.log('norm share cancel')

                this.bNormShareCancel = true

                if(this.normShareFailCallback)
                {
                    this.normShareFailCallback()
                    this.normShareFailCallback = null
                }
            }  
        })

        this.normShareTimestamp = Date.now()
        this.normShareSuccCallback = succCb
        this.normShareFailCallback = failCb
        this.bNormShareCancel = false
    }

    //该函数在切回前台的地方调用，用于计算时间差值判断是否分享成功
    static normShareResult()
    {
        if(this.normShareTimestamp > 0)
        {
            let diff = Date.now() - this.normShareTimestamp
            if(diff >= 2400) //2.4s
            {
                setTimeout(() => {
                    if(!this.bNormShareCancel)
                    {
                        if(this.normShareSuccCallback)
                        {
                            this.normShareSuccCallback()
                            this.normShareSuccCallback = null
                        }

                        G.log('norm share succ')
                    }
                }, 100)
            }
            else
            {
                if(this.normShareFailCallback)
                {
                    this.normShareFailCallback()
                    this.normShareFailCallback = null
                }

                G.log('norm share fail')
            }

            this.normShareTimestamp = 0
        }
    }

    //游戏启动时应邀信息检查
    /**
     * 
     * @param inviteCb 应邀后的回调处理，将会传入一个number值到回调函数中，1表示应邀成功，0表示应邀失败
     * @param bUnionID 是否使用unionID接口
     */
    static launchInvitationCheck()
    {
        let op = swan.getLaunchOptionsSync()
        if(G.isExistObj(op.query))
        {
            G.log('launchInvitationCheck', op)
        }
    }

    //游戏切换回前台时的应邀检查
    /**
     * 
     * @param query swan.onShow给到的query值
     * @param inviteCb 应邀后的回调处理，将会传入一个number值到回调函数中，1表示应邀成功，0表示应邀失败
     * @param bUnionID 是否使用unionId接口
     */
    static onShowInvitationCheck(query: any)
    {
        if(G.isExistObj(query) && query.id != '' && query.token != '')
        {
            G.log('onShowInvitationCheck', query)
        }
    }

    //定时功能重置
    /**
     * 
     * @param sysName 需要定时的系统模块名，使用前与服务端对齐，填写后端配置
     * @param choose 定时功能查询或启动，0为查询是否重置，1为启动定时功能
     * @param succCb 查询结果，1为已经重置，0为尚未重置
     */
    static reqTimerReset(sysName: string, choose: number, succCb?: Function)
    {
        let func = function() {
            swan.request({
                url: this.domain_ + '/user/reqTimerReset',
                data: {
                    proName: GameSetting.proName,
                    sysName: sysName,
                    openId: GameSetting.openId,
                    choose: choose.toString()
                },
                header: {
                    'content-type': 'application/json'
                },
                method: 'GET',
                dataType: 'json',
                success: (res: any) => {
                    if(res.statusCode >= 200 && res.statusCode <= 400)
                    {
                        console.log('reqTimerReset request succ', res)

                        let r = parseInt(res.data.res)
                        if(succCb)
                            succCb(r)
                    }
                    else
                    {
                        console.log('reqTimerReset request fail', res)

                        BdUtil.modalDialog('网络报告', '当前网络环境不佳，请检查网络后重试')
                    }
                },
                fail: (res: any) => {
                    console.log('reqTimerReset request fail', res)
                },
            })
        }.bind(this)

        if(GameSetting.openId == '')
        {
            BdUtil.login(function(loginRes: any) {
                GameSetting.sessionKey = loginRes.sessionKey
                GameSetting.openId = loginRes.openId

                func()

                G.log('reqTimerReset relogin', loginRes)
            }, null, true)
        }
        else
        {
            func()
        }
    }

    static adsRequestTimer = 0

    static updateAdsRequestTimer(dt: number)
    {
        this.adsRequestTimer -= dt
    }

    static videoAdsBuffer: HDMap = new HDMap()
    static videoAd = null
    static videoAdsProtectFlags: HDMap = new HDMap()

    static preloadVideoAds(unitID: string)
    {
        if(!this.videoAdsBuffer.containsKey(unitID))
        {
            let videoAd = swan.createRewardedVideoAd({
                adUnitId: unitID,
                appSid: this.adSid_
            })
            
            videoAd.load()
                .then(() => { 
                    this.videoAdsBuffer.put(unitID, videoAd)

                    console.log('preload ad succ')
                })
                .catch(err => console.log(err.errMsg))

            // videoAd.onError(function(res) {
            //     console.log('preload ad err', res)

            //     videoAd.offError()
            // })
        }
    }

    //广告观看接口，为了避免频繁点击拉取广告的行为，与updateAdsRequestTimer配合使用，
    //第一次调用后将锁定5秒，请在合适的地方调用updateAdsRequestTimer不断更新计时器，框架默认在GameLogic之中更新
    /**
     * 
     * @param unitID 广告位id，由对应项目的百度后台管理中生成
     * @param closeCbSuc 观看完毕关闭广告的回调处理
     * @param closeCbFail 中断观看关闭广告的回调处理
     * @param errCb 广告拉取报错的回调处理，具体错误码（若要使用需要判断基础库版本号>= 2.2.2）可以查阅百度官方手册
     * @param createCb 调用该函数时会进行的回调处理，比如锁定屏幕或者暂停游戏都可以在此进行
     * @param loadCb 广告拉取成功的回调，不建议使用，因为在广告观看完毕后点击关闭时百度会拉取另一条广告，会再次调用该回调
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
    static watchVideoAds(unitID: string, closeCbSuc?: Function, closeCbFail?: Function, errCb?: Function, createCb?: Function, loadCb?: Function)
    {
        if(this.adsRequestTimer > 0)
            return
        else
            this.adsRequestTimer = 5

        let info = BdUtil.sdkInfo
        console.log(info.SDKVersion)
        // if(BdUtil.compareVersion(info.SDKVersion, '2.1.0') != -1)
        {
            let closeCB = function(res: any) {
                if(BdUtil.videoAdsProtectFlags.containsKey(unitID))
                {
                    let v = BdUtil.videoAdsProtectFlags.get(unitID)
                    if(v === 1)
                        return
                }

                console.log('Ads Close callback', res.isEnded)

                AudioMgr.instance.resumeMusic()

                if(res.isEnded)
                {
                    if(closeCbSuc)
                        closeCbSuc()

                    BdUtil.videoAdsProtectFlags.put(unitID, 1)
                }
                else
                {
                    if(closeCbFail)
                        closeCbFail()
                }

                BdUtil.adsRequestTimer = 0

                BdUtil.videoAd.offClose(closeCB)
            }

            let loadCB = function(res: any) {
                console.log('Ads load callback', res)

                if(loadCb)
                    loadCb()

                BdUtil.videoAd.offLoad(loadCB)
            }

            let errorCB = function(res: any) {
                console.log('Ads error callback', res.errMsg)

                BdUtil.adsRequestTimer = 0

                if(errCb)
                    errCb(res)

                BdUtil.videoAd.offError(errorCB)
            }

            BdUtil.videoAd = this.videoAdsBuffer.get(unitID)
            if(BdUtil.videoAd)
            {
                BdUtil.videoAd.show()
                    .then(() => console.log('video show'))
                    .catch(err => console.log('video err', err))

                BdUtil.videoAdsBuffer.remove(unitID)

                BdUtil.videoAdsProtectFlags.put(unitID, 0)

                console.log('watch ads preloaded')
            }
            else
            {
                BdUtil.videoAd = swan.createRewardedVideoAd({
                    adUnitId: unitID,
                    appSid: this.adSid_
                })
                
                BdUtil.videoAd.load()
                    .then(() => { 
                        BdUtil.videoAd.show()
                            .then(() => console.log('video show'))
                            .catch(err => console.log('video err', err))

                        BdUtil.videoAdsProtectFlags.put(unitID, 0)
                    })
                    .catch(err => console.log(err.errMsg))
            }

            BdUtil.videoAd.onClose(closeCB)
            BdUtil.videoAd.onLoad(loadCB)
            BdUtil.videoAd.onError(errorCB)

            if(createCb)
                createCb()

            AudioMgr.instance.pauseMusic()
        }
        // else
        // {
        //     BdUtil.modalDialog('提示', '百度版本较低，暂不支持视频观看',
        //         null, null, false)
        // }
    }

    private static bannerAd_: BannerAd = null

    private static bannerRuleMap_: HDMap = new HDMap()
    private static bannerNormMap_: HDMap = new HDMap()
    private static bannerPreservedMap_: HDMap = new HDMap() //key: main bannerId, value: preserved bannerId
    private static preservedFailCbMap_: HDMap = new HDMap() //key: preserved bannerId, value: fail callback function
    private static preservedIdMap_: HDMap = new HDMap() //key: preserved bannerId, value: any
    private static replacedIdMap_: HDMap = new HDMap() //key: main bannerId, value: preserved bannerId

    private static bannerRefreshCntMap_: HDMap = new HDMap() 
    private static refreshRuleMap_: HDMap = new HDMap()

    private static _calBannerPos(width?: number, node?: FGUIObj, posType = 1)
    {
        let ret = { x: 0, y: 0, w: 0, h: 0 }

        let wid = this.sdkInfo.screenWidth
        if(width)
            wid = width

        let scl = wid / 300

        let hgt = 120 * scl

        let y = 0
        if(node)
        {
            let gameHgt = cc.view.getVisibleSize().height
            let posY = node.localToGlobal().y
            let offsetY = node.height * node.pivotY + 60 //微信政策，不能完全贴近按钮，需要离开40pt，设为60安全起见

            let ratio = (gameHgt - posY + offsetY) / gameHgt

            y = this.sdkInfo.screenHeight * ratio

            console.log('addBanner node', node, ratio, posY, offsetY, gameHgt - posY, gameHgt, y, this.sdkInfo.screenHeight)
        }
        else
        {
            y = this.sdkInfo.screenHeight - hgt
            if(posType == 0)
                y = 0
        }

        ret = { x: this.sdkInfo.screenWidth * 0.5 - wid * 0.5, y: y, w: wid, h: hgt }

        return ret
    }

    //添加banner广告
    /**
     * 使用前需要预加载banner
     * @param width Banner 广告组件的尺寸会根据开发者设置的宽度，即 style.width 进行等比缩放，
     * 缩放的范围是 300 到 屏幕宽度。屏幕宽度是以逻辑像素为单位的宽度，通过 swan.getSystemInfoSync() 可以获取到,
     * 当 style.width 小于 300 时，会取作 300。 当 style.width 大于屏幕宽度时，会取作屏幕宽度
     * @param node banner跟随的节点，用于banner需要跟随某些节点位置的情况
     * @param posType 0 置顶 1 置底，默认置底
     * @param bPreload 是否为预加载，预加载的banner不会立即显示，需要之后手动再次调用addBanner显示，默认不开启预加载
     * @param preservedAdId 针对adunit预留的banner id，当adunit使用完后，会尝试加载preservedAdId去顶替
     * @param preservedAdFailCb 预留的广告id如果加载失败，将会尝试调用此回调进行失败处理，处理回调由开发者自行提供
     * @param refreshRule 对于单个广告的刷新规则，在预加载时进行设置，0~999为展示次数刷新，1000以上为次数到后，
     * 预加载时才刷新（如1003，表示展示3次之后，在预加载时会刷新）
     */
    static addBanner(adunit: string, width?: number, node?: FGUIObj, posType: number = 1, bPreload = false, 
        preservedAdId: string = '', preservedAdFailCb = null, refreshRule = 5)
    {
        // if(BdUtil.compareVersion(this.sdkInfo.SDKVersion, '2.0.4') != -1)
        {
            if(preservedAdId !== '')
            {
                this.bannerPreservedMap_.put(adunit, preservedAdId)

                this.preservedIdMap_.put(preservedAdId, 1)

                if(preservedAdFailCb != null)
                    this.preservedFailCbMap_.put(preservedAdId, preservedAdFailCb)
            }

            let id = this.replacedIdMap_.get(adunit)
            if(id != null)
            {
                adunit = id

                G.log('replace banner id', id)
            }

            if(bPreload)
                this.refreshRuleMap_.put(adunit, refreshRule)

            let rule = this.refreshRuleMap_.get(adunit) || 5
            let cnt = this.bannerRefreshCntMap_.get(adunit) || 0

            console.log('banner refresh', cnt, rule, adunit)

            let bShow = false
            let bRefresh = false

            if(rule > 0 && rule < 1000)
            {
                bShow = cnt > 0 && cnt < 1000
                bRefresh = !bShow

                if(bRefresh)
                    cnt = rule
            }
            else if(rule >= 1000)
            {
                if(cnt <= 1000)
                {
                    bRefresh = true

                    if(bPreload)
                        cnt = rule
                }
                
                bShow = true
            }

            if(this.bannerAd_)
            {
                this.bannerAd_.hide()
                this.bannerAd_ = null
            }

            if(node && this.bannerRuleMap_.containsKey(node.name))
            {
                this.bannerAd_ = this.bannerRuleMap_.get(node.name)

                console.log('rule bannerAd show', node.name)
            }
            else if(node == null && this.bannerNormMap_.containsKey(adunit))
            {
                this.bannerAd_ = this.bannerNormMap_.get(adunit)

                console.log('norm bannerAd show', adunit)
            }
            else
            {
                bShow = false
                bRefresh = true

                console.log('banner no buffer')
            }
            
            if(bShow && !bPreload)
            {
                this.bannerAd_.show()
                    .then((val)=>{ console.log('banner show', adunit) })
                    .catch((err)=>{ 
                        console.log('banner show err', adunit, err) 
                        this.bannerRefreshCntMap_.put(adunit, --cnt)
                    })

                this.bannerRefreshCntMap_.put(adunit, --cnt)

                return
            }
            else if(!bRefresh)
                return

            this.bannerRefreshCntMap_.put(adunit, --cnt)

            if(node && node.name && this.bannerRuleMap_.containsKey(node.name))
            {                
                // console.log('remove banner name', node.name, this.bannerRuleMap_.toString())

                this.bannerAd_ = this.bannerRuleMap_.get(node.name)
                this.delBanner(true)

                this.bannerRuleMap_.remove(node.name)
            }
            else if(node == null && this.bannerNormMap_.containsKey(adunit))
            {
                // console.log('remove banner id', adunit, this.bannerNormMap_.toString())

                this.bannerAd_ = this.bannerNormMap_.get(adunit)
                this.delBanner(true)

                this.bannerNormMap_.remove(adunit)
            }

            let info = this._calBannerPos(width, node, posType)

            // console.log('cal pos result:', info)

            let ad = swan.createBannerAd({
                adUnitId: adunit,
                appSid: this.adSid_,
                style: {
                    left: info.x,
                    top: info.y,
                    width: info.w,
                    height: info.h
                }
            })

            this.bannerAd_ = ad
            if(!bPreload)
            {
                this.bannerAd_.show()
                    .then((val)=>{ console.log('banner show', adunit) })
                    .catch((err)=>{ 
                        console.log('banner show err', err) 
                        this.bannerRefreshCntMap_.put(adunit, --cnt)
                    })
            }
            else
                console.log('banner preload')

            let errCb = function(res) {
                G.log('Banner Ads pull failed', res)

                this.bannerAd_.offError()

                this.bannerRefreshCntMap_.put(adunit, --cnt)

                if(this.preservedIdMap_.containsKey(adunit))
                {
                    let cb = this.preservedFailCbMap_.get(adunit)
                    if(cb)
                    {
                        cb()

                        G.log('preserved banner load failed callback')
                    }
                }
                else
                {
                    if(this.bannerPreservedMap_.containsKey(adunit))
                    {
                        let id = this.bannerPreservedMap_.get(adunit)
                        BdUtil.addBanner(id, width, node, posType, bPreload)

                        this.replacedIdMap_.put(adunit, id)

                        G.log('preserved banner add', id)
                    }
                }

            }.bind(this)

            this.bannerAd_.onError(errCb)

            if(node)
            {
                this.bannerRuleMap_.put(node.name, ad)
            }
            else
            {
                this.bannerNormMap_.put(adunit, ad)
            }

            // let resizeCb = function(res) {
            //     if(this.bannerAd_)
            //     {
            //         if(this.bannerAd_.style)
            //         {
            //             this.bannerAd_.style.left = 0
            //             this.bannerAd_.style.top = info.y + 0.1;
            //             this.bannerAd_.style.width = info.w
            //             this.bannerAd_.style.height = info.h
            //         }

            //         console.log('resizeCb', this.bannerAd_)
            //     }

            //     this.bannerAd_.offResize()

            // }.bind(this)

            // this.bannerAd_.onResize(resizeCb)

            console.log('add banner')
        }
    }

    static delBanner(bDel = false)
    {
        if(this.bannerAd_)
        {
            if(bDel)
            {
                console.log('del banner')
                // console.trace()

                this.bannerAd_.destroy()
                this.bannerAd_ = null
            }
            else
            {
                this.bannerAd_.hide()

                console.log('hide banner')
            }
        }
    }

    static clearBanner()
    {
        this.bannerNormMap_.each((i, k, v) => {
            if(v)
                v.destroy()
        })
        this.bannerNormMap_.clear()

        this.bannerRuleMap_.each((i, k, v) => {
            if(v)
                v.destroy()
        })
        this.bannerRuleMap_.clear()
        
        this.delBanner(true)

        console.log('clear all banner')
    }

    //检查是否有新版本，建议使用，保障强制更新，避免版本差异造成的问题
    /**
        let cbUpdate = function() {
            //dosomething while updating,such as process anim
        }

        let cbNoUpdate = function() {
            //dosometiong if there's no update,such as game enter
        }

        BdUtil.checkVersionUpdate(cbUpdat, cbNoUpdate)
     */
    static checkVersionUpdate(cbUpdate: Function, cbNoUpdate: Function)
    {
        let info = BdUtil.sdkInfo
        // if(BdUtil.compareVersion(info.SDKVersion, '1.13.4') != -1)
        // {
            // let opSys = info.system
            // let idx = opSys.indexOf('Android')
            // if(idx !== -1)
            // {
            //     let ver = opSys.substr(7).trim()
            //     if(BdUtil.compareVersion(ver, '6.6.7') == -1)
            //     {
            //         G.console('skip update cause the system version is too low', 1, ver)

            //         if(cbNoUpdate)
            //             cbNoUpdate()

            //         return
            //     }
            // }

            G.log('check version update', info.system)

            const updateManager = swan.getUpdateManager()
            if(updateManager)
            {
                updateManager.onCheckForUpdate(function (res) {
                    // 请求完新版本信息的回调
                    console.log(res.hasUpdate)
                    if(res.hasUpdate)
                    {
                        if(cbUpdate)
                            cbUpdate()
                    }
                    else
                    {
                        if(cbNoUpdate)
                            cbNoUpdate()
                    }
                })

                updateManager.onUpdateReady(function () {
                    BdUtil.modalDialog('更新提示', '新版本已经准备好，请重启游戏', function() {
                        updateManager.applyUpdate()
                    }, null, false)
                })

                updateManager.onUpdateFailed(function () {
                    BdUtil.modalDialog('更新提示', '新版本下载失败，请确认网络环境是否良好或者重启百度', function() {
                        swan.exitMiniProgram({})
                    }, null, false)
                })
            }
            else
            {
                console.log("no updateManager")

                if(cbNoUpdate)
                    cbNoUpdate()
            }
        // }
        // else
        // {
        //     BdUtil.modalDialog('百度更新提示', '当前百度版本较低，建议升级以保障游戏体验',
        //         null, null, false)

        //     if(cbNoUpdate)
        //         cbNoUpdate()
        // }
    }

    //模态窗口，通常用在与百度接口相关的地方，考虑到与游戏风格的一体性，可以将调用此接口的地方更换为游戏中的通用对话框
    static modalDialog(head: string, text: string, confirmCb?: Function, cancelCb?: Function, 
        bSingleBtn = true, noTxt = '取消', noClr = '#000000', yesTxt = '确定', yesClr = '#3cc51f')
    {
        swan.showModal({
            title: head,
            content: text,
            showCancel: bSingleBtn,
            cancelText: noTxt,
            cancelColor: noClr,
            confirmText: yesTxt,
            confirmColor: yesClr,

            success: function (res) {
                if (res.confirm) 
                {
                    if(confirmCb)
                        confirmCb()
                }
                else if(res.cancel)
                {
                    if(cancelCb)
                        cancelCb()
                }
            }
        })
    }

    //使手机发生较短时间的振动（15 ms）。仅在 iPhone 7 / 7 Plus 以上及 Android 机型生效
    static vibrateShort()
    {
        // if(BdUtil.compareVersion(this.sdkInfo.SDKVersion, '1.2.0') != -1)
            swan.vibrateShort()
    }

    //使手机发生较长时间的振动（400 ms)
    static vibrateLong()
    {
        // if(BdUtil.compareVersion(this.sdkInfo.SDKVersion, '1.2.0') != -1)
            swan.vibrateLong()
    }

    private static recommendBtnMap_: HDMap = new HDMap()

    /**
     * 创建交叉推广按钮
     * @param btnId 用户自行定义的按钮id，用于操作创建出来的按钮
     * @param x 推广按钮左上角x坐标，注意要使用世界坐标
     * @param y 推广按钮左上角y坐标，注意要使用世界坐标，传入时注意坐标适配
     * @param type 展示类型，1为轮播 2为聚合列表，默认为1
     */
    static createRecommendationButton(btnId: string, x: number, y: number, type = 1)
    {
        let info = BdUtil.sdkInfo
        if(BdUtil.compareVersion(info.SDKVersion, '1.5.2') != -1 && swan.createRecommendationButton != null)
        {
            if(!this.recommendBtnMap_.containsKey(btnId))
            {
                let gameWid = cc.view.getVisibleSize().width
                let gameHgt = cc.view.getVisibleSize().height

                let scWid = this.sdkInfo.screenWidth
                let scHgt = this.sdkInfo.screenHeight

                let rx = scWid / gameWid * x
                let ry = scHgt / gameHgt * (gameHgt - y)

                console.log('createRecommendationButton pos', gameWid, gameHgt, scWid, scHgt, rx, ry)
                
                let t = type == 1 ? 'carousel' : 'list'
                const btn = swan.createRecommendationButton({ style: { left: rx, top: ry }, type: t })
                if(btn)
                {
                    btn.onError(()=>{
                        G.log('BDUtil createRecommendationButton error', 1, btnId)
                    })

                    this.recommendBtnMap_.put(btnId, btn)
                }
            }
        }
    }

    /**
     * 展示一个交叉推广按钮
     * @param btnId 用户自行定义的按钮id
     * @param x 可选参数，更新x坐标
     * @param y 可选参数，更新y坐标
     */
    static showRecommendationButton(btnId: string, x?: number, y?: number)
    {
        if(this.recommendBtnMap_.containsKey(btnId))
        {
            let btn = this.recommendBtnMap_.get(btnId)

            btn.onLoad(()=>{
                console.log('recommendation button loaded', btnId)    

                if(x)
                {
                    let gameWid = cc.view.getVisibleSize().width
                    let scWid = this.sdkInfo.width
                    let rx = scWid / gameWid * x
                    
                    btn.style.left = rx
                }

                if(y)
                {
                    let gameHgt = cc.view.getVisibleSize().height
                    let scHgt = this.sdkInfo.height
                    let ry = scHgt / gameHgt * (gameHgt - y)

                    btn.style.top = ry
                }

                btn.show()

                btn.offLoad()
            })

            btn.load()
        }
    }

    /**
     * 隐藏指定的交叉推广按钮
     * @param btnId 用户自行定义的按钮id
     */
    static hideRecommendationButton(btnId: string)
    {
        if(this.recommendBtnMap_.containsKey(btnId))
        {
            let btn = this.recommendBtnMap_.get(btnId)

            btn.hide()
        }
    }

    /**
     * 销毁指定的交叉推广按钮
     * @param btnId 用户自行定义的按钮id
     */
    static destroyRecommendationButton(btnId: string)
    {
        if(this.recommendBtnMap_.containsKey(btnId))
        {
            let btn = this.recommendBtnMap_.get(btnId)
            btn.offError()

            btn.destroy()

            this.recommendBtnMap_.remove(btnId)
        }
    }

    private static recorderMgr_: videoRecorderManager = null

    private static tmpRecordPath_ = ''

    /**
     * 录制视频
     * @param startCb 开始录制回调，接受一个参数传入（麦克风状态 0 为可用 1为系统禁用 2为小游戏禁用） 
     * @param stopCb 结束录制回调
     * @param errCb 录屏错误回调，接受一个参入传入（录屏错误信息）
     * @param pauseCb 暂停录屏回调
     * @param resumeCb 恢复录屏回调
     */
    static prepareVideoRecord(startCb: Function, stopCb: Function, errCb?: Function, pauseCb?: Function, resumeCb?: Function)
    {
        let info = BdUtil.sdkInfo
        if(BdUtil.compareVersion(info.SDKVersion, '1.4.1') != -1)
        {
            if(this.recorderMgr_ == null && swan.getVideoRecorderManager != null)
            {
                this.recorderMgr_ = swan.getVideoRecorderManager()

                this.recorderMgr_.onStart((res)=>{
                    G.log('BDUtil start video record')

                    if(startCb)
                        startCb(res.microphoneStatus)
                })

                this.recorderMgr_.onStop((res)=>{
                    G.log('BDUtil stop video record')

                    this.tmpRecordPath_ = res.videoPath

                    if(stopCb)
                        stopCb()
                })

                this.recorderMgr_.onError((res)=>{
                    G.log('BDUtil video record error')

                    if(errCb)
                        errCb(res.errMsg)
                })

                this.recorderMgr_.onPause(()=>{
                    G.log('BDUtil pause video record')

                    if(pauseCb)
                        pauseCb()
                })

                this.recorderMgr_.onResume(()=>{
                    G.log('BDUtil resume video record')

                    if(resumeCb)
                        resumeCb()
                })
            }
        }
        else
        {
            BdUtil.modalDialog('提示', '暂不支持录屏')
        }
    }

    /**
     * 开始录制视频，最长120s
     * @param dura 
     * @param bMicrophone 
     */
    static startVideoRecord(dura = 30, bMicrophone = false)
    {
        if(this.recorderMgr_)
        {
            this.recorderMgr_.start({ duration: dura, microphoneEnabled: bMicrophone })
        }
    }

    static pauseVideoRecord()
    {
        if(this.recorderMgr_)
            this.recorderMgr_.pause()
    }

    static resumeVideoRecord()
    {
        if(this.recorderMgr_)
            this.recorderMgr_.resume()
    }

    static stopVideoRecord()
    {
        if(this.recorderMgr_)
            this.recorderMgr_.stop()
    }

    /**
     * 分享录制好的视频文件
     * @param title 转发视频描述
     * @param query 查询字符串，必须是 key1=val1&key2=val2 的格式。
     * 从这条转发消息进入后，可通过 swan.getLaunchOptionsSync() 或 swan.onShow() 获取启动参数中的 query。
     * @param sucCb 剪辑成功的回调
     * @param failCb 剪辑失败的回调
     * @param compCb 接口调用完成回调，无论剪辑成功与否
     */
    static shareVideo(title?: string, query?: string, sucCb?: Function, failCb?: Function, compCb?: Function)
    {
        let info = BdUtil.sdkInfo
        if(BdUtil.compareVersion(info.SDKVersion, '1.4.1') != -1 && swan.shareVideo != null)
        {
            swan.shareVideo({
                videoPath: this.tmpRecordPath_,
                title: title || '',
                query: query ||  '',
                success: sucCb,
                fail: failCb,
                complete: compCb
            })
        }
    }
}
