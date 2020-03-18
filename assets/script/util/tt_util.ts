import { GameSetting } from "../game_setting";
import { GameStorage, SaveDef } from "./game_storage";
import { G } from "./global_def";
import { HttpRequest } from "./network/http_req";
import { HDMap } from "./structure/hd_map";
import { GameEventMgrInst, EventType } from "./event_mgr";
import { TimedTaskInst } from "./timed_task";
import { DataHub } from "../data/data_hub";
import { BannerSimUI } from "../game_ui/common/ad_sim_ui";

const kMaxShareDiffGroups = 5

const kTestDomain = 'http://119.23.108.126:8900/comLogin'
const kComLoginDomain = 'https://login.joyfulh.com/comLogin'

export const kPortToutiao = 'Toutiao' //头条
export const kPortDouyin = 'douyin' //抖音
export const kPortPPX = 'PPX' //皮皮虾
export const kPortXiGua = 'XiGua' //西瓜视频

export class TtUtil {
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
        TtUtil.sdkInfo = tt.getSystemInfoSync()

        console.log('[TtUitl SDK info]', TtUtil.sdkInfo.screenWidth, TtUtil.sdkInfo.screenHeight, 
            TtUtil.sdkInfo.platform, TtUtil.sdkInfo.SDKVersion, TtUtil.sdkInfo.appName)

        if(GameSetting.testServer == 1)
            TtUtil.domain_ = kTestDomain
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
        if(this.compareVersionForWx(info.SDKVersion, '1.4.0') != -1)
        {
            let rect = tt.getMenuButtonLayout();
            
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
            TtUtil._login(succCb, failCb, errorCb, bUnionID)
        }
        else
        {
            tt.checkSession({
                success: (sessionRes: any) => {
                    console.log('check session succ', sessionRes)

                    TtUtil.readData()

                    console.log('read session key', GameSetting.sessionKey)
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

    private static loginCode_ = ''

    private static _login(succCb?: Function, failCb?: Function, errorCb?: Function, bUnionID = false)
    {
        tt.login({
            success: (loginRes: any) => {
                G.log('login succ', 1, loginRes, bUnionID)

                if(loginRes.isLogin)
                {
                    if(loginRes.code)
                    {
                        this.loginCode_ = loginRes.code

                        if(!bUnionID)
                        {
                            tt.request({
                                url: this.domain_ + '/user/getSessionKey/tt',
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
                }
                else
                {
                    if(succCb)
                        succCb()
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
            GameSetting.sessionKey = res.sessionKey
        }

        let tapCb = function() {
            //dosomething
        }

        WxUtil.fetchUserInfo('UI/AutoBtn', commCb, sucCb, null, tapCb)

     */
    static fetchUserInfo(imgUrl: string, commCb?: Function, reqSucCb?: Function, reqFailCb?: Function, 
        tapCb?: Function, btnStyle?: any)
    {
        if(TtUtil.compareVersionForWx(TtUtil.sdkInfo.SDKVersion, '1.3.0') != -1)
        {
            tt.getSetting({
                success: (res: any) => {
                    if(res.authSetting['scope.userInfo'])
                    {
                        tt.getUserInfo({
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
                        if(TtUtil.compareVersionForWx(this.sdkInfo.SDKVersion, '1.3.0') != -1)
                        {
                            let image = tt.createImage();
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
                            TtUtil.modalDialog('微信更新提示', '当前微信版本较低，建议升级以保障游戏体验',
                                function() {
                                    tt.exitMiniProgram({})
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
            TtUtil.modalDialog('微信更新提示', '当前微信版本过低，请升级已保障正常游戏体验',
                function() {
                    tt.exitMiniProgram({})
            }, null, false)
        }
    }

    private static _authLogin(encryptInfo, sucCb?: Function, failCb?: Function)
    {
        tt.request({
            url: TtUtil.domain_ + '/user/auth',
            data : {
                encryptedData : encryptInfo.encryptedData,
                iv : encryptInfo.iv,
                code : TtUtil.loginCode_,
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
        let btn = tt.createUserInfoButton({
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

                let image = tt.createImage();
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
        }.bind(TtUtil)

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
        tt.request({
            url: TtUtil.domain_ + '/user/updUser',
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
        tt.showShareMenu({
            withShareTicket: false,
            success: (res: any) => {

            },
            fail: () => {

            },
            complete: () =>
            {
                
            },
        })

        tt.onShareAppMessage(function() {
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

        tt.shareAppMessage({
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

        TtUtil.normShareTimestamp = Date.now()
        TtUtil.normShareSuccCallback = succCb
        TtUtil.normShareFailCallback = failCb
        TtUtil.bNormShareCancel = false

        // this.commStatShare()
    }

    //该函数在切回前台的地方调用，用于计算时间差值判断是否分享成功
    static normShareResult()
    {
        if(TtUtil.normShareTimestamp > 0)
        {
            let diff = Date.now() - TtUtil.normShareTimestamp
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
                if(TtUtil.normShareFailCallback)
                {
                    TtUtil.normShareFailCallback()
                    TtUtil.normShareFailCallback = null
                }

                G.log('norm share fail')
            }

            TtUtil.normShareTimestamp = 0
        }
    }

    //游戏启动时应邀信息检查
    /**
     * 
     * @param inviteCb 应邀后的回调处理，将会传入一个number值到回调函数中，1表示应邀成功，0表示应邀失败
     * @param bUnionID 是否使用unionID接口
     */
    static launchInvitationCheck(inviteCb?: Function, bUnionID = false)
    {
        let op = tt.getLaunchOptionsSync()
        if(op && G.isExistObj(op.query) && op.query.img)
        {
            HttpRequest.shareClick(op.query.img)
        }
    }

    //游戏切换回前台时的应邀检查
    /**
     * 
     * @param query tt.onShow给到的query值
     * @param inviteCb 应邀后的回调处理，将会传入一个number值到回调函数中，1表示应邀成功，0表示应邀失败
     * @param bUnionID 是否使用unionId接口
     */
    static onShowInvitationCheck(query: any, inviteCb?: Function, bUnionID = false)
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
            tt.request({
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

                        TtUtil.modalDialog('网络报告', '当前网络环境不佳，请检查网络后重试')
                    }
                },
                fail: (res: any) => {
                    console.log('reqTimerReset request fail', res)
                },
            })
        }.bind(TtUtil)

        if(GameSetting.openId == '')
        {
            TtUtil.login(function(loginRes: any) {
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
            tt.request({
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
        }.bind(TtUtil)

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
        if(TtUtil.videoBonusCallback_)
        {
            // console.log('_getVideoBonus')

            TtUtil.videoBonusCallback_()
            TtUtil.videoBonusCallback_ = null
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
        let info = TtUtil.sdkInfo
        // console.log(info.SDKVersion)
        if(TtUtil.compareVersionForWx(info.SDKVersion, '1.3.0') != -1)
        {
            let closeCB = function(res: any) {
                if(TtUtil.videoAdsProtectFlags_.containsKey(unitID))
                {
                    let v = TtUtil.videoAdsProtectFlags_.get(unitID)
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

                    TtUtil.videoAdsProtectFlags_.put(unitID, 1)
                }
                else
                {
                    if(closeCbFail)
                        closeCbFail()

                    TtUtil.toast('请观看完整视频以获取奖励')

                    TtUtil.videoAdsProtectFlags_.put(unitID, 0)
                }

                if(TtUtil.videoTimeId_ > 0)
                {
                    // console.log('TimedTaskInst.remove id', WxUtil.videoTimeId_)

                    TimedTaskInst.remove(TtUtil.videoTimeId_)
                    TtUtil.videoTimeId_ = 0
                }

                TtUtil.videoBonusCallback_ = null
            }

            let errorCB = function(res: any) {
                console.log('Ads error callback', res.errMsg)

                GameEventMgrInst.addEvent(EventType.kAudioResume, null, { pauseType: 1 })

                if(errCb)
                    errCb(res)

                TtUtil.videoBonusCallback_ = null
            }

            TtUtil.videoAd_ = tt.createRewardedVideoAd({
                adUnitId: unitID
            })
            
            TtUtil.videoAd_.load()
                .then(() => { 
                    TtUtil.videoAd_.show()
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
                                this.videoTimeId_ = TimedTaskInst.add(()=>{
                                    let txt = bonusTip || '点击底部条幅可获得奖励'
                                    // WxUtil.modalDialog('提示', txt, null, null, false)
                                    this.toast(txt, 5000)

                                }, 5)

                                // console.log('TimedTaskInst.add id', this.videoTimeId_)
                            }
                        })
                        .catch(err => console.log('video err', err))

                    // WxUtil.commStatAdWatch()
                    TtUtil.videoAdsProtectFlags_.put(unitID, 0)
                })
                .catch(err => console.log(err.errMsg))

            if(TtUtil.videoAdsCallbackMap_.containsKey(unitID))
            {
                let info = TtUtil.videoAdsCallbackMap_.get(unitID) as VideoAdsInfo
                TtUtil.videoAd_.offClose(info.closeCallback)
                TtUtil.videoAd_.offError(info.errCallback)

                TtUtil.videoAdsCallbackMap_.remove(unitID)
            }

            TtUtil.videoAd_.onClose(closeCB)
            TtUtil.videoAd_.onError(errorCB)

            let info = new VideoAdsInfo(closeCB, errorCB)
            TtUtil.videoAdsCallbackMap_.put(unitID, info)
            
            if(createCb)
                createCb()
        }
        else
        {
            TtUtil.modalDialog('提示', '微信版本较低，暂不支持视频观看',
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
            TtUtil._getVideoBonus()
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

            py = TtUtil.sdkInfo.screenHeight * ratio

            console.log('_calBannerXYWZ node', ratio, posY, offsetY, gameHgt - posY, gameHgt, py, TtUtil.sdkInfo.screenHeight)
        }
        else
        {
            px = (TtUtil.sdkInfo.screenWidth - wid) * 0.5
            py = TtUtil.sdkInfo.screenHeight - hgt - 25
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
     * @param node banner跟随的节点，用于banner需要跟随某些节点位置的情况，注意采用这种模式的banner，以节点名为缓存键值，
     * 故banner的id相同，但是节点名不同的话，缓存中视为两个banner，节点名相同，banner的id不同，都视为同一个banner
     * @param width Banner 广告 最小宽度是 128（设备像素），最大宽度是 208（设备像素）
     * @param offsetY y轴偏移量，跟随节点时，y轴上离节点的偏移距离
     * @param loadCb 广告拉取成功的监听，只有预加载时需要监听是否加载成功，通常加载广告会占用较多运算资源
     * 此时如果做其他网络请求相关的操作可能被阻塞超时，建议在预加载banner时，其他操作等到预加载完成后进行，
     * loadCb和errCb可用于这样的情况
     * @param errCb 广告拉取失败处理
     * @param posType 0 置顶 1 置底，默认置底
     * @param refreshRule 对于单个广告的刷新规则，0~999为展示次数刷新，1000以上为次数到后，
     * 预加载时才刷新（如1003，表示展示3次之后，在预加载时会刷新）
     */
    static preloadBanner(adunit: string, node?: FGUIObj, width = 208, offsetY = 15, 
        loadCb: Function = null, errCb: Function = null, posType = 1, refreshRule = 4)
    {
        if(!G.isByteDance)
        {
            BannerSimUI.addTestBannerHolder(adunit, node ? node.asCom : null, posType)
            if(loadCb)
                loadCb()

            return
        }

        if(TtUtil.compareVersionForWx(TtUtil.sdkInfo.SDKVersion, '1.3.0') != -1)
        {
            if(refreshRule > 1000 && TtUtil.bnrItemMap_.containsKey(adunit))
            {
                let item = TtUtil.bnrItemMap_.get(adunit)
                if(item.refreshCnt >= refreshRule)
                    TtUtil.destroyBanner(adunit)
            }

            let item: BannerItem = null
            if(!TtUtil.bnrItemMap_.containsKey(adunit))
            {
                item = new BannerItem()

                let pos = TtUtil._calBannerXYWZ(width, node, posType, offsetY)

                item.obj = tt.createBannerAd({
                    adUnitId: adunit,
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

                    if(TtUtil.compareVersionForWx(this.sdkInfo.SDKVersion, '1.3.0') != -1)
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
                    item.obj.style.top = this.sdkInfo.screenHeight - size.height - 25
                    item.obj.style.left = (this.sdkInfo.screenWidth - size.width) / 2;

                    item.obj.offResize(sizeCb)
                }

                item.obj.onResize(sizeCb)

                let adLoadCallback = ()=>{
                    G.log('Banner pull success')

                    if(loadCb)
                        loadCb()

                    item.obj.offLoad(adLoadCallback)
                }

                item.obj.onLoad(adLoadCallback)

                TtUtil.bnrItemMap_.put(adunit, item)
            }
        }
    }

    static isBannerShowed(adunit: string)
    {
        if(!G.isByteDance)
        {
            return BannerSimUI.isTestBannerHolderShowed(adunit)
        }

        let bRet = false
        if(TtUtil.bnrItemMap_.containsKey(adunit))
        {
            let item = TtUtil.bnrItemMap_.get(adunit)
            bRet = item.bShow
        }

        return bRet
    }

    static isBannerLimited(adunit: string)
    {
        if(!G.isByteDance)
        {
            return BannerSimUI.isTestBannerLimited(adunit)
        }

        let bRet = false
        if(TtUtil.bnrItemMap_.containsKey(adunit))
        {
            let item = TtUtil.bnrItemMap_.get(adunit)
            bRet = item.bLimited
        }

        return bRet
    }

    static showBanner(adunit: string)
    {
        if(!G.isByteDance)
        {
            BannerSimUI.showTestBannerHolder(adunit)

            return
        }

        if(TtUtil.compareVersionForWx(TtUtil.sdkInfo.SDKVersion, '1.3.0') != -1)
        {
            TtUtil.hideLastOne()

            if(TtUtil.bnrItemMap_.containsKey(adunit))
            {
                let item = TtUtil.bnrItemMap_.get(adunit) as BannerItem

                if(item.refreshRule < 1000 && item.refreshCnt >= item.refreshRule)
                {
                    let newItem = new BannerItem()

                    newItem.obj = tt.createBannerAd({
                        adUnitId: adunit,
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

                        if(TtUtil.compareVersionForWx(this.sdkInfo.SDKVersion, '1.3.0') != -1)
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
                        item.obj.style.top = this.sdkInfo.screenHeight - size.height - 25
                        item.obj.style.left = (this.sdkInfo.screenWidth - size.width) / 2;
    
                        item.obj.offResize(sizeCb)
                    }
    
                    item.obj.onResize(sizeCb)

                    newItem.x = item.x
                    newItem.y = item.y
                    newItem.w = item.w
                    newItem.h = item.h

                    item.del()

                    TtUtil.bnrItemMap_.remove(adunit)
                    TtUtil.bnrItemMap_.put(adunit, newItem)

                    item = newItem
                }

                item.show()

                TtUtil.lastBnrItemStack_.push(item)
            }
        }
    }

    static hideBanner(adunit: string)
    {
        if(!G.isByteDance)
        {
            BannerSimUI.hideTestBannerHolder(adunit)

            return
        }

        if(TtUtil.bnrItemMap_.containsKey(adunit))
        {
            let item = TtUtil.bnrItemMap_.get(adunit)
            item.hide()

            TtUtil.lastBnrItemStack_.pop()
            if(TtUtil.lastBnrItemStack_.length > 0)
            {
                TtUtil.lastBnrItemStack_[TtUtil.lastBnrItemStack_.length - 1].show()
            }
        }
    }

    static showLastOne()
    {   
        if(!G.isByteDance)
        {
            BannerSimUI.showLastTestBanner()
            return
        }

        if(TtUtil.lastBnrItemStack_.length > 0)
        {
            TtUtil.lastBnrItemStack_[TtUtil.lastBnrItemStack_.length - 1].show()
        }
    }

    static hideLastOne()
    {
        if(!G.isByteDance)
        {
            BannerSimUI.hideLastTestBanner()
            return
        }

        if(TtUtil.lastBnrItemStack_.length > 0)
        {
            TtUtil.lastBnrItemStack_[TtUtil.lastBnrItemStack_.length - 1].hide()
        }
    }

    static destroyBanner(adunit: string)
    {
        if(TtUtil.bnrItemMap_.containsKey(adunit))
        {
            let item = TtUtil.bnrItemMap_.get(adunit) as BannerItem
            item.del()

            for(let i = 0; i < TtUtil.lastBnrItemStack_.length; ++i)
            {
                if(TtUtil.lastBnrItemStack_[i].id === adunit)
                {
                    TtUtil.lastBnrItemStack_.splice(i, 1)
                    break
                }
            }

            TtUtil.bnrItemMap_.remove(adunit)
        }
    }

    static hideAllBanners()
    {
        if(!G.isByteDance)
        {
            BannerSimUI.hideAllTestBanner()
            return
        }

        TtUtil.hideLastOne()

        TtUtil.bnrItemMap_.each((i, k, v)=>{
            this.hideBanner(k)
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
        let info = TtUtil.sdkInfo
        if(TtUtil.compareVersionForWx(info.SDKVersion, '1.9.0') != -1)
        {
            let opSys = info.system
            let idx = opSys.indexOf('Android')
            if(idx !== -1)
            {
                let ver = opSys.substr(7).trim()
                if(TtUtil.compareVersionForWx(ver, '6.6.7') == -1)
                {
                    G.log('skip update cause the system version is too low', 1, ver)

                    if(cbNoUpdate)
                        cbNoUpdate()

                    return
                }
            }

            G.log('check version update', info.system)

            const updateManager = tt.getUpdateManager()

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
                TtUtil.modalDialog('更新提示', '新版本已经准备好，请重启游戏', function() {
                    updateManager.applyUpdate()
                }, null, false)
            })

            updateManager.onUpdateFailed(function () {
                TtUtil.modalDialog('更新提示', '新版本下载失败，请确认网络环境是否良好或者重启微信', null, null, false)
            })
        }
        else
        {
            TtUtil.modalDialog('更新提示', '当前app版本较低，建议升级以保障游戏体验',
                null, null, false)

            if(cbNoUpdate)
                cbNoUpdate()
        }
    }

    //模态窗口，通常用在与微信接口相关的地方，考虑到与游戏风格的一体性，可以将调用此接口的地方更换为游戏中的通用对话框
    static modalDialog(head: string, text: string, confirmCb?: Function, cancelCb?: Function, 
        bSingleBtn = true, noTxt = '取消', noClr = '#000000', yesTxt = '确定', yesClr = '#3cc51f')
    {
        tt.showModal({
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
        tt.showToast({ title: text, duration: dura, icon: 'none' })
    }

    //使手机发生较短时间的振动（15 ms）。仅在 iPhone 7 / 7 Plus 以上及 Android 机型生效
    static vibrateShort()
    {
        if(TtUtil.compareVersionForWx(TtUtil.sdkInfo.SDKVersion, '1.0.0') != -1)
            tt.vibrateShort()
    }

    //使手机发生较长时间的振动（400 ms)
    static vibrateLong()
    {
        if(TtUtil.compareVersionForWx(TtUtil.sdkInfo.SDKVersion, '1.0.0') != -1)
            tt.vibrateLong()
    }

    //默认的更多游戏跳转列表，如果不传入跳转启动参数，则读取此默认列表中的
    private static defaultLaunchOptions_ = [
        //可按如下格式填写跳转列表，其中query和extraData为可选参数
        // { appId: "ttXXXXXX", query: "foo=bar&baz=qux", extraData: {} }
        { appId: "tt90b7e60a0f9d5a88" },
        { appId: "tte77191cc785b3fdb" },
        { appId: "tt826ff4d21d455943" },
        { appId: "tt3f5449e9a07efb4d" },
        { appId: "tt1794612988becef1" },
        { appId: "tt4eff3842d1d593ee" },
        { appId: "tted059bb8722fc13c" },
        { appId: "tt5327259acc0d91e5" },
        { appId: "ttb698c02529b27ff9" },
        { appId: "tte25794ea7d7d28fb" },
    ]

    private static bListenMGModalClose_ = false

    /**
     * 弹出更多游戏对话框
     * @param lauchOpt 小游戏启动参数选项，不填写则使用defaultLaunchOptions_中的进行填充
     * @param sucCb 跳转成功后的回调，可选参数
     * @param failCb 取消跳转或跳转失败后的回调，可选参数
     * @param closeCb 关闭更多游戏界面的回调
     */
    static popMoreGamesDialog(lauchOpt?: any[], sucCb?: Function, failCb?: Function, closeCb?: Function)
    {
        let info = this.sdkInfo
        if(info.platform !== "ios")
        {
            if(this.compareVersionForWx(info.SDKVersion, '1.33.0') !== -1)
            {
                let opt = lauchOpt || this.defaultLaunchOptions_
                tt.showMoreGamesModal({
                    appLaunchOptions: opt,
                })

                if(!this.bListenMGModalClose_)
                {
                    // 监听弹窗关闭
                    tt.onMoreGamesModalClose(function() {
                        if(closeCb)
                            closeCb()
                    })

                    this.bListenMGModalClose_ = true
                }

                tt.offNavigateToMiniProgram()

                // 监听小游戏跳转
                tt.onNavigateToMiniProgram((res)=> {
                    // console.log(res.errCode)
                    // console.log(res.errMsg)
                    // console.log(res.from)

                    if(res.errCode === 0)
                    {
                        if(sucCb)
                            sucCb()
                    }
                    else
                    {
                        if(failCb)
                            failCb()
                    }
                })
            }
        }
    }

    private static moreGameBtn_: MoreGamesButton = null

    /**
     * 创建更多游戏按钮，目前在皮皮虾中不存在这个接口，在西瓜视频中可能显示不出来图片，故采用文本模式
     * @param x 按钮x坐标（设计分辨率下的）
     * @param y 按钮y坐标（设计分辨率下的）
     * @param w 按钮宽（设计分辨率下的）
     * @param h 按钮高（设计分辨率下的）
     * @param imgPath 按钮图片本地路径，只有在type为0时有效
     * @param txt 按钮的文本，只有在type为1时有效
     * @param lauchOpt 小游戏启动参数选项，不填写则使用defaultLaunchOptions_中的进行填充
     * @param succCb 跳转成功后的回调，可选参数
     * @param failCb 取消跳转或跳转失败后的回调，可选参数
     * @param onClick 点击了更多游戏按钮的回调
     * @param type 按钮类型，0为图片 1为文本，默认为0
     */
    static createMoreGamesButton(x: number, y: number, w: number, h: number, imgPath?: string, txt?: string, 
        lauchOpt?: any[], succCb?: Function, failCb?: Function, onClick?: Function, type = 0)
    {
        if(!this.moreGameBtn_)
        {
            let info = this.sdkInfo
            if(info.appName !== kPortPPX && info.platform !== "ios" && 
                this.compareVersionForWx(info.SDKVersion, '1.23.0') !== -1)
            {
                let bVert = cc.view.getVisibleSize().height > cc.view.getVisibleSize().width

                let sclX = info.screenWidth / cc.view.getVisibleSize().width
                let sclY = info.screenHeight / cc.view.getVisibleSize().height

                let scl = bVert ? sclX : sclY

                let px = x * sclX
                let py = y * sclY
                let aw = w * scl
                let ah = h * scl

                console.log('createMoreGamesButton', x, y, w, h, px, py, aw, ah, scl, sclX, sclY)

                let borderWid = 0
                let borderRad = 0
                if(info.appName === kPortXiGua)
                {
                    type = 1
                    txt = '更多游戏'
                    borderWid = 2
                    borderRad = 10
                }

                this.moreGameBtn_ = tt.createMoreGamesButton({
                    type: type === 0 ? "image" : "text",
                    image: imgPath,
                    text: txt,
                    style: {
                        left: px,
                        top: py,
                        width: aw,
                        height: ah,
                        lineHeight: 24,
                        backgroundColor: "#e5e4f1",
                        textColor: "#413f59",
                        textAlign: "center",
                        fontSize: 20,
                        borderRadius: borderRad,
                        borderWidth: borderWid,
                        borderColor: "#413f59"
                    },

                    appLaunchOptions: lauchOpt || this.defaultLaunchOptions_,

                    onNavigateToMiniGame(res) {
                        // console.log("跳转其他小游戏", res);

                        if(res.errCode === 0)
                        {
                            if(succCb)
                                succCb()
                        }
                        else
                        {
                            if(failCb)
                                failCb()
                        }
                    }
                })

                this.moreGameBtn_.onTap(onClick)

                this.moreGameBtn_.hide()
            }
        }
    }

    static showMoreGamesButton()
    {
        if(this.moreGameBtn_)
        {
            this.moreGameBtn_.show()
        }
    }

    static hideMoreGamesButton()
    {
        if(this.moreGameBtn_)
        {
            this.moreGameBtn_.hide()
        }
    }

    /** 视屏录制完毕的临时路径，用于视屏分享 */
    static gameRecordVideoTempPath = ''
    static gameRecordClipIndexList = []

    private static gameRecorderMgr_: GameRecorderManager = null
    private static gameRecTimstamp_ = 0

    private static bGameRecording_ = false

    /**
     * 预备游戏录屏
     * @param startCb 开始录屏回调 
     * @param stopCb 停止录屏回调，接收一个string类型的videoPath用于视屏分享，如果videoPath为空，则为不足3s的视屏
     * @param errCb 录屏出错时的回调
     * @param pauseCb 录屏暂停回调
     * @param resumeCb 录屏恢复回调
     */
    public static prepareGameRecord(startCb?: Function, stopCb?: Function, errCb?: Function, 
        pauseCb?: Function, resumeCb?: Function)
    {
        let info = this.sdkInfo
        if(this.compareVersionForWx(info.SDKVersion, '1.4.1') !== -1)
        {
            if(!this.gameRecorderMgr_)
            {
                this.gameRecorderMgr_ = tt.getGameRecorderManager()

                this.gameRecorderMgr_.onStart(()=>{
                    if(startCb)
                        startCb()

                    this.gameRecordVideoTempPath = ''
                    this.gameRecTimstamp_ = Date.now()
                    this.bGameRecording_ = true
                    this.gameRecordClipIndexList = []

                    console.log('[TtUtil prepareGameRecord] on start', this.gameRecTimstamp_)
                })

                this.gameRecorderMgr_.onStop((res)=>{
                    let diff = Date.now() - this.gameRecTimstamp_
                    if(diff >= 3000)
                    {
                        this.gameRecordVideoTempPath = res.videoPath
                    }
                    else
                    {
                        this.gameRecordVideoTempPath = ''

                        if(this.bGameRecording_)
                            this.toast('录屏时间不足3秒', 2000)
                    }

                    if(stopCb)
                        stopCb(this.gameRecordVideoTempPath)

                    this.bGameRecording_ = false

                    console.log('[TtUtil prepareGameRecord] on stop', this.gameRecTimstamp_, diff)
                })

                this.gameRecorderMgr_.onError((errMgs: string)=>{
                    if(errCb)
                        errCb()

                    console.log('[TtUtil prepareGameRecord] on error', errMgs)
                })

                this.gameRecorderMgr_.onPause(()=>{
                    if(pauseCb)
                        pauseCb()

                    console.log('[TtUtil prepareGameRecord] on pause')
                })

                this.gameRecorderMgr_.onResume(()=>{
                    if(resumeCb)
                        resumeCb()

                    console.log('[TtUtil prepareGameRecord] on resume')
                })

                if(this.compareVersionForWx(info.SDKVersion, '1.6.1') !== -1)
                {
                    this.gameRecorderMgr_.onInterruptionBegin(()=>{
                        this.gameRecorderMgr_.pause()
                    })

                    this.gameRecorderMgr_.onInterruptionEnd(()=>{
                        this.gameRecorderMgr_.resume()
                    })
                }
            }
        }
    }

    /**
     * 开始录制视屏
     * @param dura 录制视屏长度，默认300s
     */
    static startGameRecord(dura = 300)
    {
        if(this.gameRecorderMgr_)
        {
            this.gameRecorderMgr_.start({ duration: dura })

            console.log('[TtUtil startGameRecord]', dura)
        }
    }

    static stopGameRecord()
    {
        if(this.gameRecorderMgr_)
        {
            this.gameRecorderMgr_.stop()
            
            console.log('[TtUtil stopGameRecord]')
        }
    }

    static pauseGameRecord()
    {
        if(this.gameRecorderMgr_)
        {
            this.gameRecorderMgr_.pause()
        }
    }

    static resumeGameRecord()
    {
        if(this.gameRecorderMgr_)
        {
            this.gameRecorderMgr_.resume()
        }
    }

    static clearGameRecord()
    {
        this.gameRecordVideoTempPath = ''
        this.gameRecordClipIndexList = []
        this.bGameRecording_ = false
    }

    /**
     * 记录一次视频录制裁剪，只有在开始录屏后调用才有效，可以多次调用，记录不同时刻
     * @param frontTimeRange 以调用时的录屏时刻为基准，指定前 x 秒到基准时刻为将要裁剪的片段
     * @param backTimeRange 以调用时的录屏时刻为基准，指定后 y 秒到基准时刻为将要裁剪的片段
     * @param succCb 记录剪辑片段成功的回调函数，返回一个唯一索引index，用于clipGameRecord接口调用时指定裁剪拼接顺序
     * @param failCb 记录剪辑片段失败的回调函数
     */
    static cutGameRecordClip(frontTimeRange = 0, backTimeRange = 0, 
        succCb: Function = null, failCb: Function = null)
    {
        if(this.gameRecorderMgr_ && this.bGameRecording_)
        {
            let info = this.sdkInfo
            if(this.compareVersionForWx(info.SDKVersion, '1.20.0') !== -1)
            {
                this.gameRecorderMgr_.recordClip({ 
                    timeRange: [ frontTimeRange, backTimeRange ],
                    success: (res)=>{
                        this.gameRecordClipIndexList.push(res.index)

                        if(succCb)
                            succCb(res)
                    },
                    fail: ()=>{
                        if(failCb)
                            failCb()
                    }
                })
            }
        }
    }

    /**
     * 剪辑精彩的视频片段，与cutGameRecordClip搭配使用，请务必在录屏的stop回调中才调用
     * @param frontTimeRange 以结束录屏的时刻为基准，指定前x秒到基准时刻为将要裁剪的片段
     * @param clipIdxLst 若不传clipIdxLst字段，会按照默认的cutGameRecordClip的调用顺讯裁剪视频并合并，
     * 使用gameRecordClipIndexList记录的剪辑索引，对于cutGameRecordClip调用时，frontTimeRange与backTimeRange
     * 之间可能产生交集的部分会自动合并，确保生成的视频内容是无重复且顺序符合记录顺序。
     * 若指定了clipIdxLst字段，平台将只会按clipIdxLst数据的顺序裁剪合并视频，并对于重复的部分不做处理，
     * 可利用该功能实现自定义裁剪片段、自定义拼接顺序（若同时指定了frontTimeRange，该片段将依旧作为最后一段拼接），
     * 对于最终视频可能出现的重复内容，需要开发者自己保证。
     * @param succCb 剪辑成功回调，接收一个string类型的videoPath用于视屏分享
     * @param failCb 剪辑失败的回调函数
     */
    static clipGameRecord(frontTimeRange = 0, clipIdxLst: number[] = null, 
        succCb: Function = null, failCb: Function = null)
    {
        if(this.gameRecorderMgr_ && this.gameRecordClipIndexList.length > 0)
        {
            let info = this.sdkInfo
            if(this.compareVersionForWx(info.SDKVersion, '1.20.0') !== -1)
            {
                this.gameRecorderMgr_.clipVideo({
                    path: this.gameRecordVideoTempPath,
                    timeRange: [ frontTimeRange, 0 ],
                    clipRange: clipIdxLst || this.gameRecordClipIndexList,
                    success: (res)=> {
                        console.log('[TtUtil clipGameRecord] path', res.videoPath);

                        if(succCb)
                            succCb(res.videoPath)

                        this.gameRecordVideoTempPath = res.videoPath
                    },
                    fail: (e)=> {
                        console.log('[TtUtil clipGameRecord] error', e)

                        if(failCb)
                            failCb()
                    }
                });
            }
        }
    }

    private static shRecTimeIdForDY_ = 0

    /**
     * 分享录制好的视屏
     * @param title 视屏分享标题
     * @param desc 视屏分享描述
     * @param query 查询值
     * @param videoTopics 视屏话题（仅抖音平台生效）
     * @param succCb 分享成功回调
     * @param failCb 分享失败回调
     */
    static shareRecordVideo(title?: string, desc?: string, query?: string, 
        videoTopics?: string[], succCb?: Function, failCb?: Function)
    {
        console.log('shareRecordVideo', this.gameRecordVideoTempPath)

        if(this.gameRecordVideoTempPath == '')
        {
            this.toast('不存在录制视频')
        }
        else
        {
            tt.shareAppMessage({
                channel: "video",
                title: title || '',
                desc: desc || '',
                query: query || '',
                extra: {
                    videoPath: this.gameRecordVideoTempPath, // 可替换成录屏得到的视频地址
                },
                success: ()=> {
                    console.log("分享视频成功")

                    if(succCb)
                        succCb()
                },
                fail: (e)=> {
                    console.log("分享视频失败")

                    if(e && e.errMsg && e.errMsg.indexOf('cancel') === -1)
                    {
                        this.toast('暂无可以分享的视频')
                    }
                    else
                        this.toast('请分享视频获取奖励')

                    if(failCb)
                        failCb()
                }
            })

            let info = this.sdkInfo
            if(info.appName === kPortDouyin)
            {
                console.log('[TtUitl shareRecordVideo] for douyin')
                if(this.shRecTimeIdForDY_ > 0)
                {
                    TimedTaskInst.remove(this.shRecTimeIdForDY_)
                    this.shRecTimeIdForDY_ = 0
                }

                this.shRecTimeIdForDY_ = TimedTaskInst.add(()=>{ 
                    if(succCb)
                        succCb()
                }, 5)
            }
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
        if(TtUtil.audioInfoMap_.containsKey(path))
        {
            info = TtUtil.audioInfoMap_.get(path)
        }
        else
        {
            info = new AudioInfo(path)

            TtUtil.audioInfoMap_.put(path, info)
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
        if(TtUtil.audioInfoMap_.containsKey(path))
        {
            let info = TtUtil.audioInfoMap_.get(path) as AudioInfo
            if(info.endCallback)
                info.obj.offEnded(info.endCallback)

            info.endCallback = endCb

            info.obj.onEnded(info.endCallback)
        }
    }

    //恢复音频播放
    static resumeAudio(path: string)
    {
        if(TtUtil.audioInfoMap_.containsKey(path))
        {
            let info = TtUtil.audioInfoMap_.get(path)
            info.obj.play()
        }
    }

    //暂停音频播放
    static pauseAudio(path: string)
    {
        if(TtUtil.audioInfoMap_.containsKey(path))
        {
            let info = TtUtil.audioInfoMap_.get(path)
            info.obj.pause()
        }
    }

    //停止播放
    static stopAudio(path: string)
    {
        if(TtUtil.audioInfoMap_.containsKey(path))
        {
            let info = TtUtil.audioInfoMap_.get(path)
            info.obj.stop()
        }
    }

    //销毁不再需要的音频实例
    static destroyAudio(path: string)
    {
        if(TtUtil.audioInfoMap_.containsKey(path))
        {
            let info = TtUtil.audioInfoMap_.get(path)
            if(info.endCallback)
                info.obj.offEnded(info.endCallback)
                
            info.obj.destroy()

            TtUtil.audioInfoMap_.remove(path)
        }
    }
}

class AudioInfo {   
    obj: InnerAudioContext = null
    endCallback: Function = null

    constructor(path: string)
    {
        this.obj = tt.createInnerAudioContext()
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