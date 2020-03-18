
import { G } from "./global_def";
import { HDMap } from "./structure/hd_map";
import { HttpRequest } from "./network/http_req";
import { GameSetting } from "../game_setting";
import { GameStorage, SaveDef } from "./game_storage";
import { GameEventMgrInst, EventType } from "./event_mgr";
import { BannerSimUI } from "../game_ui/common/ad_sim_ui";
import { TimedTaskInst } from "./timed_task";
import { DataHub } from "../data/data_hub";
import { GameUserInfo } from "../game/user_info";

const kMaxShareDiffGroups = 5

const kTestDomain = 'http://119.23.108.126:8900/comLogin'
const kComLoginDomain = 'https://login.joyfulh.com/comLogin'

export class WxUtil {
    public static sdkInfo = null

    private static domain_ = kComLoginDomain

    static saveData()
    {
        let sav = {
            openId: GameSetting.openId,
        }
        GameStorage.writeJSON(SaveDef.kWxStatus, sav)
    }

    static readData()
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
        this.sdkInfo = wx.getSystemInfoSync()

        console.log('[WxUtil SDK info]', this.sdkInfo.screenWidth, this.sdkInfo.screenHeight, this.sdkInfo.platform, this.sdkInfo.SDKVersion)

        if(GameSetting.testServer == 1)
            this.domain_ = kTestDomain
    }

    //对比微信基础库版本号，返回1 代表v1Str大，返回-1 代表v2Str大，返回0则相等
    public static compareVersionForWx(v1Str: String, v2Str: String) 
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

    /**
     * 将右上角菜单的包围矩形转化为适应游戏当前分辨率的矩形
     * @param offsetX x轴偏移量
     * @param offsetY y轴偏移量
     * @return 返回菜单按钮按当前游戏分辨率折算的坐标与尺寸
     */
    public static convertMenuButtonRect(offsetX = 0, offsetY = 0)
    {
        let ret = { x: 0, y: 0, w: 0, h: 0 }
        let info = this.sdkInfo
        if(this.compareVersionForWx(info.SDKVersion, '2.1.0') != -1)
        {
            let rect = wx.getMenuButtonBoundingClientRect();
            
            let gameWid = cc.view.getVisibleSize().width
            let gameHgt = cc.view.getVisibleSize().height

            let ratioX = gameWid / info.screenWidth
            let ratioY = gameHgt / info.screenHeight

            ret.x = rect.left * ratioX + offsetX
            ret.y = rect.top * ratioY + offsetY
            ret.w = rect.width * ratioX
            ret.h = rect.height * ratioY

            // console.log('getMenuButtonRect', rect, ret, ratioX, ratioY)
        }

        return ret
    }

    //静默登录
    /**
     * 
     * @param succCb 登录成功后请求sessionKey成功的回调，成功后服务端将返回openId和sessionKey，格式data.res = { openId = 'xxx', sessionKey = 'xxx' }
     * @param failCb 登录成功后请求sessionKey失败的回调，一般不需要
     * @param errorCb 特殊问题（如网络连接超时）失败后的回调
     * @param bForceLogin 因为登录态会保持一段时间，检查到会话存在就不会执行登录操作，如果需要强制重登，请将此标志位置为true
     * @param bUnionID 当需要获取unionID时，登录仅仅只请求到会话code即可，不再进行获取sessionKey的操作
     * 
        let succCb = function() {
            
        }

        WxUtil.login(succCb, null, true)
     */
    static login(succCb?: Function, failCb?: Function, errorCb?: Function, bForceLogin = false, bUnionID = false)
    {
        if(bForceLogin)
        {
            this._login(succCb, failCb, errorCb, bUnionID)
        }
        else
        {
            wx.checkSession({
                success: (sessionRes: any) => {
                    console.log('check session succ', sessionRes)

                    WxUtil.readData()

                    // console.log('read session key', GameSetting.sessionKey)
                },
                fail: (sessionRes: any) => {
                    console.log('check session fail', sessionRes)

                    this._login(succCb, failCb, errorCb, bUnionID)
                },
                complete: (sessionRes: any) => {

                }
            })
        }
    }

    private static loginCode = ''

    private static _login(succCb?: Function, failCb?: Function, errorCb?: Function, bUnionID = false)
    {
        wx.login({
            success: (loginRes: any) => {
                G.log('login succ', 1, loginRes, bUnionID)
                if(loginRes.code)
                {
                    this.loginCode = loginRes.code

                    if(!bUnionID)
                    {
                        wx.request({
                            url: this.domain_ + '/user/getSessionKey',
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

                                if(errorCb)
                                    errorCb(res)
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

                if(errorCb)
                    errorCb(loginRes)
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
     * @param commCb 通用信息回调，获取到通用信息时进行回调，这些信息不包含unionid一类的敏感信息，具体可以查阅微信接口
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

        WxUtil.fetchUserInfo('UI/AutoBtn', commCb, sucCb, null, tapCb)

     */
    static fetchUserInfo(imgUrl: string, commCb?: Function, reqSucCb?: Function, reqFailCb?: Function, 
        tapCb?: Function, btnStyle?: any)
    {
        if(WxUtil.compareVersionForWx(this.sdkInfo.SDKVersion, '1.2.0') != -1)
        {
            wx.getSetting({
                success: (res: any) => {
                    if(res.authSetting['scope.userInfo'])
                    {
                        wx.getUserInfo({
                            withCredentials: true,
                            lang: 'zh_CN',
                            success: (userRes: any) => {
                                if(commCb)
                                    commCb(userRes.userInfo)

                                this._authLogin(userRes, reqSucCb, reqFailCb)
                            },

                            fail: (res: any) => {
                                G.log('get setting scope userInfo failed', 1, res)
                            },

                            complete: (res: any) => {

                            },
                        })
                    }
                    else
                    {
                        if(WxUtil.compareVersionForWx(this.sdkInfo.SDKVersion, '2.0.1') != -1)
                        {
                            let image = wx.createImage();
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
                        else
                        {
                            WxUtil.modalDialog('微信更新提示', '当前微信版本较低，建议升级以保障游戏体验',
                                function() {
                                    wx.exitMiniProgram({})
                            }, null, false)
                        }
                    }
                },

                fail: (res: any) => {

                },

                complete: (res: any) => {

                }
            })
        }
        else
        {
            WxUtil.modalDialog('微信更新提示', '当前微信版本过低，请升级已保障正常游戏体验',
                function() {
                    wx.exitMiniProgram({})
            }, null, false)
        }
    }

    private static _authLogin(encryptInfo, sucCb?: Function, failCb?: Function)
    {
        wx.request({
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
        let btn = wx.createUserInfoButton({
            type: 'image',
            text: 'txt',
            image: imgUrl,
            style: style,
            withCredentials: true,
            lang: 'zh_CN',
        })

        btn.show()

        G.log('create button', 1, btn)

        let tpCb = function(res) {
            G.log('_authentication onTap', 1, res)

            if(res.iv == null || res.encryptedData == null)
            {
                G.log('cancel auth')

                let image = wx.createImage();
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
        wx.request({
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

        WxUtil.showForward(cb)
    */ 
    static showForward(callback: Function)
    {
        wx.showShareMenu({
            withShareTicket: false,
            success: (res: any) => {

            },
            fail: () => {

            },
            complete: () =>
            {
                
            },
        })

        wx.onShareAppMessage(function() {
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
        let idx = imageUrl.lastIndexOf('Shared/')
        let proName = GameSetting.proName

        let img = ''
        if(idx != -1)
        {
            img = imageUrl.substring(idx + proName.length + 8)
        }

        HttpRequest.shareOut(img)

        wx.shareAppMessage({
            title: title,
            imageUrl: imageUrl,
            // query: 'snk=1&gid=' + GameSetting.gameId,
            query: 'img=' + img,
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

        // this.commStatShare()
    }

    /**
     * 接入天幕系统使用的分享接口
     * @param sc 分享场景id
     * @param sucCb 分享成功回调
     * @param failCb 分享失败回调
     * @param qry 分享query值
     */
    static shareForTMSDK(sc: string, sucCb?: Function, failCb?: Function, qry = '')
    {
        if(G.isTMSDK)
        {
            wx.tmSDK.shareAppMessage({
                scene: sc, // 必填，分享位ID
                success: ()=>{ sucCb && sucCb() },
                cancel: ()=>{ failCb && failCb() },
                query: qry, // 自行定义传入分享的参数
            })
        }
        else
        {
            G.log('tmSdk is not active,share for tmSdk can not be invoking')
        }
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
     * @param bUnionID 是否使用unionID接口
     */
    static launchQueryCheck(bUnionID = false)
    {
        let op = wx.getLaunchOptionsSync()
        if(op && G.isExistObj(op.query) && op.query.img)
        {
            HttpRequest.shareClick(op.query.img)
        }
    }

    //游戏切换回前台时的应邀检查
    /**
     * 
     * @param query wx.onShow给到的query值
     * @param inviteCb 应邀后的回调处理，将会传入一个number值到回调函数中，1表示应邀成功，0表示应邀失败
     * @param bUnionID 是否使用unionId接口
     */
    static onShowQueryCheck(query: any, bUnionID = false)
    {
        if(G.isExistObj(query) && query.img)
        {
            HttpRequest.shareClick(query.img)
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
            wx.request({
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

                        WxUtil.modalDialog('网络报告', '当前网络环境不佳，请检查网络后重试')
                    }
                },
                fail: (res: any) => {
                    console.log('reqTimerReset request fail', res)
                },
            })
        }.bind(this)

        if(GameSetting.openId == '')
        {
            WxUtil.login(function(loginRes: any) {
                GameSetting.sessionKey = loginRes.sessionKey
                GameSetting.openId = loginRes.openId

                func()

                G.log('reqTimerReset relogin', 1, loginRes)
            }, null, null, true)
        }
        else
        {
            func()
        }
    }

    //与reqTimerReset用法一致，唯一需要注意noUnionIdCb需要用户自行处理，当不存在unionId时该作什么处理
    static reqTimerResetUnion(sysName: string, choose: number, succCb?: Function, noUnionIdCb?: Function)
    {
        let func = function() {
            wx.request({
                url: this.domain_ + '/user/reqTimerResetU',
                data: {
                    proName: GameSetting.proName,
                    sysName: sysName,
                    unionId: GameSetting.unionId,
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
                        console.log('reqTimerResetUnion request succ', res)

                        let r = parseInt(res.data.res)
                        if(succCb)
                            succCb(r)
                    }
                    else
                    {
                        console.log('reqTimerResetUnion request fail', res)
                    }
                },
                fail: (res: any) => {
                    console.log('reqTimerResetUnion request complete fail', res)
                },
            })
        }.bind(this)

        if(GameSetting.unionId == '')
        {
            if(noUnionIdCb)
                noUnionIdCb()
        }
        else
        {
            func()
        }
    }

    private static videoBonusCallback_: Function = null

    private static videoAd_ = null
    private static videoTimeId_ = 0

    private static videoAdsProtectFlags_: HDMap = new HDMap()
    private static videoAdsCallbackMap_ = new HDMap()

    private static _getVideoBonus()
    {
        if(this.videoBonusCallback_)
        {
            // console.log('_getVideoBonus')

            this.videoBonusCallback_()
            this.videoBonusCallback_ = null
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
        let info = WxUtil.sdkInfo
        // console.log(info.SDKVersion)
        if(WxUtil.compareVersionForWx(info.SDKVersion, '2.1.0') != -1)
        {
            let closeCB = function(res: any) {
                if(WxUtil.videoAdsProtectFlags_.containsKey(unitID))
                {
                    let v = WxUtil.videoAdsProtectFlags_.get(unitID)
                    if(v === 1)
                        return
                }

                console.log('Ads Close callback', res.isEnded)

                GameEventMgrInst.addEvent(EventType.kAudioResume, null, { pauseType: 1 })

                if(res && res.isEnded || res === undefined)
                {
                    if(closeCbSuc)
                        closeCbSuc()

                    // WxUtil.commStatAdWatchSucc()

                    WxUtil.videoAdsProtectFlags_.put(unitID, 1)
                }
                else
                {
                    if(closeCbFail)
                        closeCbFail()

                    WxUtil.videoAdsProtectFlags_.put(unitID, 0)
                }

                WxUtil.videoBonusCallback_ = null
            }

            let errorCB = function(res: any) {
                console.log('Ads error callback', res.errMsg)

                GameEventMgrInst.addEvent(EventType.kAudioResume, null, { pauseType: 1 })

                if(errCb)
                    errCb(res)

                WxUtil.videoBonusCallback_ = null
            }

            WxUtil.videoAd_ = wx.createRewardedVideoAd({
                adUnitId: unitID
            })
            
            WxUtil.videoAd_.load()
                .then(() => { 
                    WxUtil.videoAd_.show()
                        .then(() => { 
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

                                // console.log('TimedTaskMgr.instance.add id', this.videoTimeId_)
                            }
                        })
                        .catch(err => console.log('video err', err))

                    // WxUtil.commStatAdWatch()
                    WxUtil.videoAdsProtectFlags_.put(unitID, 0)
                })
                .catch(err => console.log(err.errMsg))

            if(this.videoAdsCallbackMap_.containsKey(unitID))
            {
                let info = this.videoAdsCallbackMap_.get(unitID) as VideoAdsInfo
                WxUtil.videoAd_.offClose(info.closeCallback)
                WxUtil.videoAd_.offError(info.errCallback)

                this.videoAdsCallbackMap_.remove(unitID)
            }

            WxUtil.videoAd_.onClose(closeCB)
            WxUtil.videoAd_.onError(errorCB)

            let info = new VideoAdsInfo(closeCB, errorCB)
            this.videoAdsCallbackMap_.put(unitID, info)
            
            if(createCb)
                createCb()
        }
        else
        {
            WxUtil.modalDialog('提示', '微信版本较低，暂不支持视频观看',
                null, null, false)
        }
    }

    static bannerStat(res)
    {
        if(this.bBnrShowed_)
            WxUtil.recordBannerClickSucTimestamp()

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
            this._getVideoBonus()
        }
    }

    private static bnrItemMap_ = new HDMap() //key: adunit value: BannerItem
    private static lastBnrItemStack_: BannerItem[] = []

    private static bnrHideCbMap_ = new HDMap() //key: id value: callback
    private static bnrRefreshTaskId_ = 0

    private static bBnrShowed_ = false

    private static bnrClickCDTimestamp_ = 0
    private static bnrClickSucTimestamp_ = 0

    static recordBannerCDTimestamp()
    {
        this.bnrClickCDTimestamp_ = Date.now()
    }

    /**
     * banner点击是否处于CD中
     */
    static isBannerClickCD()
    {
        let ret = false

        if(this.bnrClickCDTimestamp_ > 0)
        {
            let cd = Date.now() - this.bnrClickCDTimestamp_
            ret = (cd / 1000) < DataHub.config.bnrClickCD

            G.log('isBannerClickCD', ret)
        }

        return ret
    }

    static recordBannerClickSucTimestamp()
    {
        this.bnrClickSucTimestamp_ = Date.now()

        G.log('recordBannerClickSucTimestamp', this.bnrClickSucTimestamp_)
    }

    /**
     * 判断banner是否成功点击
     */
    static decideBannerClickSuc()
    {
        if(this.bnrClickSucTimestamp_ > 0)
        {
            let diff = Date.now() - this.bnrClickSucTimestamp_
            if((diff / 1000) < DataHub.config.bnrClickSucTime)
            {
                G.log('decideBannerClickSuc', diff)

                GameUserInfo.addBannerClickCnt()
                this.recordBannerCDTimestamp()

                this.bnrClickSucTimestamp_ = 0 
            }
        }
    }

    private static _calBannerXYWZ(width?: number, node?: FGUIObj, posType = 1, offsetY = 15)
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

            let ratio = (posY + offsetY) / gameHgt

            y = this.sdkInfo.screenHeight * ratio

            console.log('addBanner node', ratio, posY, offsetY, gameHgt - posY, gameHgt, y, this.sdkInfo.screenHeight)
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

    static interAd = null

	/**
     * 创建插屏广告
     * @param id 广告id
     */
    static addInterstitialAd(id: string)
    {
        let info = WxUtil.sdkInfo
        if(WxUtil.compareVersionForWx(info.SDKVersion, '2.6.0') != -1)
        {
            try {
                this.interAd = wx.createInterstitialAd({ adUnitId: id })
            } 
            catch (error) {
                console.log('addInterstitialAd', error)
            }
        }
    }

    /**
     * 展示插屏广告
     */
    static showInterstitialAd()
    {
        let info = WxUtil.sdkInfo
        if(WxUtil.compareVersionForWx(info.SDKVersion, '2.6.0') != -1 && this.interAd)
        {
            // if(this.interAd)
            // {
            //     this.interAd.offClose()
            //     this.interAd.offError()
            //     this.interAd.offLoad()
            // }

            try {
                this.interAd.show()
            }
            catch (error) {
                console.log('showInterstitialAd', error)
            }
            
            // this.interAd.onLoad(()=>{

            // })

            // this.interAd.onError(()=>{

            // })

            // this.interAd.onClose(()=>{

            // })
        }
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
        let info = WxUtil.sdkInfo
        if(WxUtil.compareVersionForWx(info.SDKVersion, '1.9.90') != -1)
        {
            let opSys = info.system
            let idx = opSys.indexOf('Android')
            if(idx !== -1)
            {
                let ver = opSys.substr(7).trim()
                if(WxUtil.compareVersionForWx(ver, '6.6.7') == -1)
                {
                    G.log('skip update cause the system version is too low', 1, ver)

                    if(cbNoUpdate)
                        cbNoUpdate()

                    return
                }
            }

            G.log('check version update', info.system)

            const updateManager = wx.getUpdateManager()

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
                WxUtil.modalDialog('更新提示', '新版本已经准备好，请重启游戏', function() {
                    updateManager.applyUpdate()
                }, null, false)
            })

            updateManager.onUpdateFailed(function () {
                WxUtil.modalDialog('更新提示', '新版本下载失败，请确认网络环境是否良好或者重启微信', null, null, false)
            })
        }
        else
        {
            WxUtil.modalDialog('微信更新提示', '当前微信版本较低，建议升级以保障游戏体验',
                null, null, false)

            if(cbNoUpdate)
                cbNoUpdate()
        }
    }

    //模态窗口，通常用在与微信接口相关的地方，考虑到与游戏风格的一体性，可以将调用此接口的地方更换为游戏中的通用对话框
    static modalDialog(head: string, text: string, confirmCb?: Function, cancelCb?: Function, 
        bSingleBtn = true, noTxt = '取消', noClr = '#000000', yesTxt = '确定', yesClr = '#3cc51f')
    {
        wx.showModal({
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

    static toast(text: string, dura = 1500)
    {
        wx.showToast({ title: text, duration: dura, icon: 'none' })
    }

    private static gameClub_ = null

    //显示游戏圈图标
    /**
     * 
     * @param left 图标左上角x轴，注意要用逻辑像素（即适配系统屏幕坐标系而不是引擎的，使用sdkInfo中获取的宽高来进行计算）
     * @param top 图标左上角y轴
     * @param width 图标宽度
     * @param height 图标高度
     */
    static showGameClub(left: number, top: number, width: number, height: number)
    {
        if(WxUtil.compareVersionForWx(this.sdkInfo.SDKVersion, '2.0.3') != -1)
        {
            if(this.gameClub_ == null)
            {
                this.gameClub_ = wx.createGameClubButton({
                    type: 'image',
                    text: '',
                    image: '',
                    style: {
                        left: left,
                        top: top,
                        width: width,
                        height: height,
                    },
                    icon: 'dark'
                })
            }

            this.gameClub_.show()
        }
    }

    static hideGameClub()
    {
        if(G.isExistObj(this.gameClub_))
        {
            this.gameClub_.hide()
        }
    }

    static removeGameClub()
    {
        if(G.isExistObj(this.gameClub_))
        {
            this.gameClub_.destroy()
            this.gameClub_ = null
        }
    }

    //使手机发生较短时间的振动（15 ms）。仅在 iPhone 7 / 7 Plus 以上及 Android 机型生效
    static vibrateShort()
    {
        if(WxUtil.compareVersionForWx(this.sdkInfo.SDKVersion, '1.2.0') != -1)
            wx.vibrateShort()
    }

    //使手机发生较长时间的振动（400 ms)
    static vibrateLong()
    {
        if(WxUtil.compareVersionForWx(this.sdkInfo.SDKVersion, '1.2.0') != -1)
            wx.vibrateLong()
    }

    /**
     * 音频选项，设置后全局生效
     * @param mixWithOther 是否与其他音频混播，设置为 true 之后，不会终止其他应用或微信内的音乐
     * @param obeyMuteSwitch （仅在 iOS 生效）是否遵循静音开关，设置为 false 之后，即使是在静音模式下，也能播放声音
     */
    static setAudioOption(mixWithOther: boolean, obeyMuteSwitch: boolean)
    {
        if(WxUtil.compareVersionForWx(this.sdkInfo.SDKVersion, '2.3.0') != -1)
        {
            wx.setInnerAudioOption({ mixWithOther: mixWithOther, obeyMuteSwitch: obeyMuteSwitch })
        }
    }

    private static audioInfoMap_ = new HDMap() //key: path value:AudioInfo

    /**
     * 音频播放
     * @param path 音频资源的地址
     * @param bLoop 是否循环播放，默认为 false
     * @param startTime 开始播放的位置（单位：s），默认为 0
     * @param volume 音量。范围 0~1。默认为 1
     * @param bAuto 是否自动开始播放，默认为 false
     */
    static playAudio(path: string, bLoop = false, startTime = 0, volume = 1, bAuto = false)
    {
        let info: AudioInfo = null
        if(this.audioInfoMap_.containsKey(path))
        {
            info = this.audioInfoMap_.get(path)
        }
        else
        {
            info = new AudioInfo(path)

            this.audioInfoMap_.put(path, info)
        }

        if(info)
        {
            let audio = info.obj
            if(audio)
            {
                audio.src = path
                audio.startTime = startTime
                audio.volume = volume
                audio.loop = bLoop
                audio.autoplay = bAuto

                audio.play()
            }
        }
    }

    static addAudioCallback(path: string, endCb?: Function)
    {
        if(this.audioInfoMap_.containsKey(path))
        {
            let info = this.audioInfoMap_.get(path) as AudioInfo
            if(info.endCallback)
                info.obj.offEnded(info.endCallback)

            info.endCallback = endCb

            info.obj.onEnded(info.endCallback)
        }
    }

    //恢复音频播放
    static resumeAudio(path: string)
    {
        if(this.audioInfoMap_.containsKey(path))
        {
            let info = this.audioInfoMap_.get(path)
            info.obj.play()
        }
    }

    //暂停音频播放
    static pauseAudio(path: string)
    {
        if(this.audioInfoMap_.containsKey(path))
        {
            let info = this.audioInfoMap_.get(path)
            info.obj.pause()
        }
    }

    //停止播放
    static stopAudio(path: string)
    {
        if(this.audioInfoMap_.containsKey(path))
        {
            let info = this.audioInfoMap_.get(path)
            info.obj.stop()
        }
    }

    //销毁不再需要的音频实例
    static destroyAudio(path: string)
    {
        if(this.audioInfoMap_.containsKey(path))
        {
            let info = this.audioInfoMap_.get(path)
            if(info.endCallback)
                info.obj.offEnded(info.endCallback)
                
            info.obj.destroy()

            this.audioInfoMap_.remove(path)
        }
    }
}

class AudioInfo {   
    obj: InnerAudioContext = null
    endCallback: Function = null

    constructor(path: string)
    {
        this.obj = wx.createInnerAudioContext()
    }
}

class VideoAdsInfo {
    closeCallback: Function = null
    errCallback: Function = null

    constructor(closeCb: Function, errCb: Function)
    {
        this.closeCallback = closeCb
        this.errCallback = errCb
    }
}

class BannerItem {
    id = ''

    obj: BannerAd = null

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