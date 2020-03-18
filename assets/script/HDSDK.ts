
const kNetCfg = {
    resServer: 'https://huandong-1257458597.cos.ap-guangzhou.myqcloud.com/HDSDK/NavList/Pub/',
    qrResServer: 'https://huandong-1257458597.cos.ap-guangzhou.myqcloud.com/HDSDK/NavList/QRCode/',
    bnrResServer: 'https://huandong-1257458597.cos.ap-guangzhou.myqcloud.com/HDSDK/NavList/Banner/',
    commServer: "https://login.joyfulh.com/comLogin",
    statServer: "https://statistic.joyfulh.com/statistic",

    nav: '/jumpData/getJumpData',
    updImportStat: '/data/updImportStat',
    updExportStat: '/data/updExportStat'
}

class SendData {
    url: string = ''
    data: string = ''
}

const kRefreshTime = 15 * 60 * 1000
const kRequestTime = 10 * 1000
const kRequestInterval = 15 * 1000

const kMaxRequests = 5

class ReqData {
    gridCb = null
    likeCb = null
    qrCb = null
    bnrCb = null
}

export class HDNavData {
    sn = 0 //编号，用于后台识别
    path = '' //跳转页面参数，小游戏中作为query值使用
    img = '' //游戏icon的url
    type = 0 //类型，1为九宫格，2为猜你喜欢，3为二维码，4同时为九宫格和猜你喜欢
    extra = null //跳转时捎带数据
    appId = '' //跳转id
    id = '' //缓存id
    name = '' //游戏名
    alias = '' //别名（一般为拼音或英文名，避免统计时偶然的中文显示异常）
    qrUrl = '' //二维码拉取地址
    bnrUrl = '' //条幅广告拉取地址
    tag = 0 //是否带有标签（比如热门、小红点之类的）
    verCode = '' //验证码，用来判定是否有数据更新
    box = 0 //是否跳转盒子
    //----天幕SDK专属数据，不直接从后台接收，用于代码中中转数据
    tmPosId = '' //天幕SDK中的positionId
    tmCid = '' //天幕SDK中的creativeId
    //天幕SDK中show_config下的image对应HDNavData的img，而title对应name
}

export class HDSDK {
    private static gridArr_: HDNavData[] = []
    private static likeArr_: HDNavData[] = [] 
    private static qrArr_: HDNavData[] = []
    private static bnrArr_: HDNavData[] = []

    private static forceMap_ = {} //强制导出的数据集合,k:appId v:HDNavData array
    private static forceIds_: string[] = []

    private static datMap_ = {}

    private static openID_ = ''
    private static proName_ = ''

    private static lastRefreshTime_ = 0
    private static lastReqTime_ = 0

    private static reqQue_ = [] //避免短时间重复请求，会将请求缓存起来，最多缓存3次
    private static reqLimited_ = 0 //请求上限，如果总是请求不到数据，需要重启游戏后才会重置请求

    private static bDownloaded_ = false

    private static reqTimerId_ = 0

    private static autoTimerId_ = 0

    private static newUser_ = 1

    private static currPage_ = 1

    private static loginTime_ = 0

    private static dataLen_ = 0

    private static bRegister_ = false

    private static bLoadedNative_ = false

    private static bUpdateNav_ = false
    private static bDataExisted_ = false

    /**
     * 是否需要更新跳转信息，如果存在本地数据，那么在读取本地数据后依然会去后台拉取最新数据信息
     * 如果后台信息与当前读取到的本地数据有差异，那么将会标记为需要更新数据，此时可以考虑将跳转相关的UI细节更新,
     * 
     * 用户可以考虑自行安排周期间隔轮询改值，然后根据结果来进行跳转UI的刷新
     */
    static get needUpdateNavData()
    {
        return this.bUpdateNav_
    }

    /**
     * 是否已经存在数据，在初始化后，如果不传入回调，那么可以通过此方法轮询是否已经收到了数据，
     * 然后通过getXXXArray系列的方法获取到数据进行操作
     */
    static get isDataExisted()
    {
        return this.bDataExisted_
    }

    /** 获取强制导出的数据id */
    static get getForceNavIds()
    {
        return this.forceIds_
    }

    /**
     * 获取强制导出数据
     * @param appId 由getForceNavIds中选取一个值作为传入数据
     * @return 返回一个appId对应的跳转数据，没有则返回null，当有同id数据时，随机返回其中一个
     */
    static getForceNavData(appId: string)
    {
        let ret: HDNavData = null

        if(this.forceMap_[appId])
        {
            let arr = this.forceMap_[appId]
            if(arr)
            {
                let min = 0
                let max = arr.length - 1
                ret = arr[Math.round(Math.random() * (max - min)) + min]
            }
        }

        return ret
    }

    /**
     * SDK注册，会进行登录获取openId的操作，并且openId获取成功与否都会调用init初始化跳转数据
     * openId获取成功后会在几小时内本地化缓存，第二次会直接使用上次的openId
     * @param proName 由欢动对接人给出的项目名
     * @param gridCb 可选参数，九宫格数据回调，接受一个HDNavData数组参数，为九宫格数据
     * @param likeCb 可选参数，猜你喜欢数据回调，接受一个HDNavData数组参数，为猜你喜欢数据
     * @param qrCb 可选参数，二维码数据回调，接受一个HDNavData数组参数，为二维码跳转数据
     * @param bnrCb 可选参数，条幅广告数据回调，接受一个HDNavData数组参数，为条幅广告跳转数据
     */
    static register(proName: string, gridCb?: Function, likeCb?: Function, qrCb?: Function, bnrCb?: Function)
    {
        this._readSave()
        this.bRegister_ = true

        let diff = Date.now() - this.loginTime_
        if(this.openID_ && this.openID_ !== '' && this.openID_ != 'null' &&
            diff <= 14400000)
        {
            this.init(this.openID_, proName, gridCb, likeCb, qrCb, bnrCb)

            console.log('[HDSDK] no need login', diff, this.openID_)
        }
        else
        {
            if(this._isMinigamePlat)
            {
                console.log('[HDSDK] login for SDK')

                this._login(proName, gridCb, likeCb, qrCb, bnrCb)
            }
            else
            {
                this.init('', proName, gridCb, likeCb, qrCb, bnrCb)
            }
        }
    }

    /**
     * 初始化SDK信息，同时会进行一次后台数据的拉取，需要在登录微信拿到openId后调用
     * @param openId 登录微信后获取到的用户唯一id
     * @param proName 由欢动对接人给出的项目名
     * @param gridCb 可选参数，九宫格数据回调，接受一个HDNavData数组参数，为九宫格数据
     * @param likeCb 可选参数，猜你喜欢数据回调，接受一个HDNavData数组参数，为猜你喜欢数据
     * @param qrCb 可选参数，二维码数据回调，接受一个HDNavData数组参数，为二维码跳转数据
     * @param bnrCb 可选参数，条幅广告数据回调，接受一个HDNavData数组参数，为条幅广告跳转数据
     * 
     * 使用样例：
     * 
     * let gridCb = function(arr: HDNavData[]) {
     *      for(let i = 0; i < arr.length; ++i)
     *      {
     *          //根据传入的数据进行操作
     *      }
     * }
     * 
     * let likeCb = function(arr: HDNavData[]) {
     *      //Do something
     * }
     * 
     * let qrCb = function(arr: HDNavData[]) {
     *      //Do something
     * }
     * 
     * let bnrCb = function(arr: HDNavData[]) {
     *      //Do something
     * }
     * 
     * HDSDK.init('xxxxxxx', 'test', gridCb, likeCb, qrCb)
     * 
     * 备注：
     * 上述样例的arr格式为 
     * [ 
     *  {"path":"?hdg=1","img":"icon8","type":4,"extra":"{ "d": "c"}","id":"wx5a64c07aaf5f918a","name":"夺命神枪手"},
     *  {"path":"?hdg=2","img":"icon4","type":4,"extra":"{ "bf":"a"}","id":"wxf7d7cf59e84c2fae","name":"萌犬过河"},
     *  ........    
     * ]
     * arr为一个数组，其中每个元素包含如下属性，path为跳转路径path，作为游戏来源query值使用，img为显示的图标，extra为附加数据extraData，id为跳转id，name为游戏名
     */
    static init(openId: string, proName: string, gridCb?: Function, likeCb?: Function, qrCb?: Function, bnrCb?: Function)
    {
        this.openID_ = openId || ''
        this.proName_ = proName

        if(!this.bRegister_)
            this._readSave()

        console.log('[HDSDK] init', this.newUser_, proName, this.openID_)

        let bRefresh = Date.now() - this.lastRefreshTime_ > kRefreshTime
        if(!bRefresh)
        {
            if(this.gridArr_.length > 0 && gridCb)
                gridCb(this.gridArr_)

            if(this.likeArr_.length > 0 && likeCb)
                likeCb(this.likeArr_)

            if(this.qrArr_.length > 0 && qrCb)
                qrCb(this.qrArr_)

            if(this.bnrArr_.length > 0 && bnrCb)
                bnrCb(this.bnrArr_)
        }
        else
        {
            this.bDownloaded_ = false

            this.loadNativeData(gridCb, likeCb, qrCb, bnrCb)

            this._requstQueue(gridCb, likeCb, qrCb, bnrCb)
        }

        if(this._isMinigamePlat)
        {
            let op = wx.getLaunchOptionsSync()
            if(op.query && (op.query.hdg && op.query.hdg != '' || 
                op.query.HDg_nav_0 && op.query.HDg_nav_0 != ''))
            {
                let src = op.query.HDg_nav_0 || op.query.hdg

                this._reportImportStat(proName, openId, src)
            }
        }

        this.bRegister_ = false
        this.newUser_ = 0
        if(this.openID_ != '' && this.openID_ != 'null')
        {
            if(this._isMinigamePlat)
            {
                wx.setStorageSync('user', this.openID_)
                wx.setStorageSync('login', this.loginTime_)
            }
            else
            {
                localStorage.setItem('user', this.openID_)
            }
        }
    }

    static loadNativeData(gridCb?: Function, likeCb?: Function, qrCb?: Function, bnrCb?: Function)
    {
        if(!this.bLoadedNative_)
        {
            if(typeof window['Laya'] !== 'undefined')
            {
                window['Laya'].loader.load('data/hd_nav.json', window['Laya'].Handler.create(null, ()=>{
                    let res = window['Laya'].loader.getRes('data/hd_nav.json');
                    if(res)
                    {
                        this._parseNavData(res, gridCb, likeCb, qrCb, bnrCb)
            
                        window['Laya'].loader.clearRes('data/hd_nav.json')
                    }
                    else
                        console.log('no native data')
        
                }), null, window['Laya'].Loader.JSON);
            }
            else if(typeof window['cc'] !== 'undefined')
            {
                window['cc'].loader.loadRes('data/hd_nav.json', window['cc'].JsonAsset, function(err, res) {
                    if(err)
                        console.log('no native data')
                    else
                    {
                        this._parseNavData(res.json, gridCb, likeCb, qrCb, bnrCb)
        
                        window['cc'].loader.release(res)
                    }
                })
            }
        }
    }

    /**
     * 获取九宫格数据信息，数组类型为HDNavData[]
     */
    static getGridArray()
    {
        return this.gridArr_
    }

    /**
     * 获取猜你喜欢数据信息，数组类型为HDNavData[]
     */
    static getLikeArray()
    {
        return this.likeArr_
    }

    /**
     * 获取二维码数据信息，数组类型为HDNavData[]
     */
    static getQRCodeArray()
    {
        return this.qrArr_
    }

    /**
     * 获取条幅广告信息，数组类型为HDNavData[]
     */
    static getBannerArray()
    {
        return this.bnrArr_
    }

    /**
     * 小游戏跳转，微信环境下生效
     * @param id 传入跳转的小游戏id
     * @param sucCb 可选参数，玩家点击确认跳转后的回调
     * @param failCb 可选参数，玩家点击取消跳转后的回调
     */
    static navigate(id: string, sucCb?: Function, failCb?: Function)
    {
        if(this._isMinigamePlat)
        {
            if(this.datMap_[id])
            {
                let dat = this.datMap_[id]
                if(dat.type === 3)
                {
                    wx.previewImage({ 
                        urls: [ dat.qrUrl ],
                        success: (res: any)=>{
                            console.log('[HDSDK] navigate qr')
                        }
                    })
                }
                else
                {
                    let info = wx.getSystemInfoSync()
                    if(this._compareVersionForWx(info.SDKVersion, '2.2.0') == 1)
                    {
                        if(dat.box === 1)
                        {
                            if(info.platform.indexOf('ios') !== -1)
                            {
                                if(failCb)
                            		failCb()

                                return
                            }
                        }

                        wx.navigateToMiniProgram({ 
                            appId: dat.appId,
                            path: dat.path,
                            extraData: dat.extra,
                            // envVersion: 'trial',
                            success: ()=>{
                                this._reportExportStat(dat)

                                if(sucCb)
                                	sucCb()
                            },
                            fail: ()=>{
                            	if(failCb)
                            		failCb()
                            }
                        })
                    }
                    else
                    {
                        wx.showModal({
                            title: '版本提示',
                            content: '微信版本较低，暂不支持游戏跳转',
                        })
                    }
                }
            }
        }
        else
        {
            let dat = this.datMap_[id] as HDNavData
            console.log('[HDSDK] not wechat platform,navigate data is', dat.sn, dat.name, dat)
        }
    }

    /**
     * 上报小游戏导入数据，在确保SDK初始化后使用
     * @param src 来源的query值，与量方沟通后确定传入数据
     * 
     * 使用样例：
     * 
     * let op = wx.getLaunchOptionsSync()
     * 
     * if(op && op.query && op.query != '')
     * {
     *      if(op.query.xxx != '')
     *          HDSDK.uploadImportData(op.query.xxx) //此处op.query.xxx中的xxx指代量方跳转时携带的query值
     * }
     */
    static uploadImportData(src: string)
    {
        if(this.newUser_ === 1)
            this._reportImportStat(this.proName_, this.openID_, src)
    }

    //------------------------------------------------------
    private static _fetchData(proName: string, gridCb?: Function, likeCb?: Function, qrCb?: Function, bnrCb?: Function)
    {
        if(proName && proName !== '')
        {
            this._getNavData(proName, (dat)=>{
                console.log('[HDSDK] fetch data', dat)

                if(dat && dat.res)
                {
                    if(this.currPage_ === 1 && dat.res.length > 0)
                    {
                        // let bUpdate = false
                        // if(this.bLoadedNative_)
                        // {
                        //     for(let i = 0; i < dat.res.length; ++i)
                        //     {
                        //         if(this._checkUpdate(dat.res[i]))
                        //         {
                        //             this.bUpdateNav_ = true
                        //             bUpdate = true
                        //             break
                        //         }
                        //     }
                        // }
                        // else
                        //     bUpdate = true

                        this.bUpdateNav_ = true

                        this.bDownloaded_ = true

                        // if(bUpdate)
                        // {
                            this.datMap_ = {}
                            this.forceMap_ = {}
                            this.forceIds_ = []
                            this.gridArr_ = []
                            this.likeArr_ = []
                            this.qrArr_ = []
                            this.bnrArr_ = []

                            this.reqQue_ = []

                            this.bDataExisted_ = false

                            // if(this.autoTimerId_ > 0)
                            //     clearTimeout(this.autoTimerId_)

                            console.log('[HDSDK] page one clear flag')
                        // }
                        // else
                        // {
                        //     console.log('[HDSDK] no need to update data')

                        //     return
                        // }
                    }

                    if(dat.res.length > 0) //如果存在分页数据，则继续请求下一页
                    {
                        ++this.currPage_

                        this._fetchData(proName, gridCb, likeCb, qrCb, bnrCb)
                    }

                    let arr = dat.res as Array<any>
                    for(let i = 0; i < arr.length; ++i)
                    {
                        this._createNavData(arr[i])
                    }

                    if(this.gridArr_.length > 0 || this.likeArr_.length > 0)
                        this.lastRefreshTime_ = Date.now()
                    else
                        this.lastRefreshTime_ = 0

                    if(dat.res.length == 0 && this.currPage_ >= 1) //如果存在分页数据，则继续请求下一页
                    {
                        if(gridCb)
                            gridCb(this.gridArr_)

                        if(likeCb)
                            likeCb(this.likeArr_)

                        if(qrCb)
                            qrCb(this.qrArr_)

                        if(bnrCb)
                            bnrCb(this.bnrArr_)

                        this.bDataExisted_ = true
                    }
                }
            })
        }
    }

    private static _readSave()
    {
        let usr = null
        if(this._isMinigamePlat)
        {
            try {
                usr = wx.getStorageSync('user')
                let t = wx.getStorageSync('login')
                this.loginTime_ = Number(t)
            }
            catch(e)
            {
                this.loginTime_ = 0
                usr = null
            }
        }
        else
        {
            usr = localStorage.getItem('user')
        }

        if(usr)
        {
            this.newUser_ = 0

            console.log('[HDSDK] read dat', usr, this.loginTime_)

            if(usr != '' && usr != 'null')
            {
                this.openID_ = usr
            }
        }
        else
            this.newUser_ = 1
    }

    private static _getNavData(proName: string, sucCb: Function)
    {
        let url = kNetCfg.commServer + kNetCfg.nav

        let data = {
            proName: proName,
            page: this.currPage_,
            limit: 20
        }

        this._common(url, data, sucCb)
    }

    private static _parseNavData(data, gridCb?: Function, likeCb?: Function, qrCb?: Function, bnrCb?: Function)
    {
        if(this.bDownloaded_)
            return

        for (const key in data) 
        {
            if (data.hasOwnProperty(key))
                this._createNavData(data[key], true)
        }

        if(gridCb && this.gridArr_.length > 0)
            gridCb(this.gridArr_)

        if(likeCb && this.likeArr_.length > 0)
            likeCb(this.likeArr_)

        if(qrCb && this.qrArr_.length > 0)
            qrCb(this.qrArr_)

        if(bnrCb && this.bnrArr_.length > 0)
            bnrCb(this.bnrArr_)

        this.bLoadedNative_ = true
        this.bDataExisted_ = true

        console.log('[HDSDK] load native data')
    }

    //检查是否更新数据，在读取了本地数据之后，如果后端拉取到了数据会进行对应的校验检查，有新的则覆盖
    private static _checkUpdate(raw)
    {
        let bRet = false

        let id = raw.id + '_' + raw.s

        if(this.datMap_[id])
        {
            let dat = this.datMap_[id] as HDNavData

            let code = this._genVerificationCode(raw)

            if(dat.verCode != code)
            {
                bRet = true
            }
        }

        return bRet
    }

    private static _createNavData(raw, bGenCode = false)
    {
        let nav = new HDNavData()

        let img = raw.img as string
        if(img.indexOf('.') !== -1) //有后缀直接使用后缀
        {
            nav.img = kNetCfg.resServer + raw.img
        }
        else //无后缀默认为.png
            nav.img = kNetCfg.resServer + raw.img + '.png'
        
        nav.sn = raw.s
        nav.type = raw.t
        nav.name = raw.n
        nav.path = raw.p
        nav.alias = raw.a
        if(raw.e !== '')
            nav.extra = JSON.parse(raw.e)
        nav.appId = raw.id
        nav.id = nav.appId + '_' + nav.sn

        if(bGenCode)
            nav.verCode = this._genVerificationCode(raw)

        if(nav.extra)
        {
            if(nav.extra.bnr)
            {
                let bnr = nav.extra.bnr
                if(bnr.indexOf('.') !== -1) //有后缀直接使用后缀
                {
                    nav.bnrUrl = kNetCfg.bnrResServer + bnr
                }
                else //无后缀默认为.png
                    nav.bnrUrl = kNetCfg.bnrResServer + bnr + '.png'

                this.bnrArr_.push(nav)
            }

            if(nav.extra.tag)
                nav.tag = 1

            if(nav.extra.box)
                nav.box = 1

            if(nav.extra.force)
            {
                if(this.forceMap_[nav.appId])
                {
                    let arr = this.forceMap_[nav.appId]
                    arr.push(nav)
                }
                else
                {
                    this.forceMap_[nav.appId] = []
                    this.forceMap_[nav.appId].push(nav)

                    this.forceIds_.push(nav.appId)
                }
            }
        }

        if(raw.t === 1)
        {
            this.gridArr_.push(nav)
        }
        else if(raw.t === 2)
        {
            this.likeArr_.push(nav)
        }
        else if(raw.t === 3)
        {
            if(nav.extra && nav.extra.qr)
            {
                let qr = nav.extra.qr
                if(qr.indexOf('.') !== -1) //有后缀直接使用后缀
                {
                    nav.qrUrl = kNetCfg.qrResServer + qr
                }
                else //无后缀默认为.png
                    nav.qrUrl = kNetCfg.qrResServer + qr + '.png'
            }

            this.qrArr_.push(nav)
        }
        else if(raw.t === 4)
        {
            this.gridArr_.push(nav)
            this.likeArr_.push(nav)
        }

        this.datMap_[nav.id] = nav
    }

    private static _genVerificationCode(raw)
    {
        let code = ''

        let start = raw.s + raw.n + raw.a
        let p: string = raw.p
        let mid = p.length + p.charAt(0) + p.charAt(Math.round(p.length / 2)) + p.charAt(p.length - 1)
        let end = ''
        if(raw.e !== '')
        {
            let e: string = raw.e
            end = e.length + e.charAt(0) + e.charAt(Math.round(e.length / 2)) + e.charAt(e.length - 1)
        }

        code = start + mid + end

        return code
    }

    private static _reportImportStat(proName: string, openId: string, src: string)
    {
        if(openId != null && openId != 'null' && openId != '')
        {
            let url = kNetCfg.statServer + kNetCfg.updImportStat

            let data = {
                proName: proName,
                openid: openId,
                source: src
            }

            this._common(url, data, null)

            console.log('[HDSDK] import stat', openId, src)
        }
        else
        {
            this._login(proName)

            console.error('[HDSDK] _reportImportStat openId不存在，请保证openId的获取')
        }
    }

    private static _reportExportStat(dat: HDNavData)
    {
        if(this.openID_ != null && this.openID_ != 'null' && this.openID_ != '')
        {
            let url = kNetCfg.statServer + kNetCfg.updExportStat

            let loc = ''
            if(dat.bnrUrl !== '')
                loc = 'banner' + dat.sn
            else
            {
                if(dat.type == 1)
                    loc = 'grid' + dat.sn
                else if(dat.type == 2)
                    loc = 'like' + dat.sn
                else if(dat.type == 4)
                    loc = 'all' + dat.sn
            }

            let data = {
                proName: this.proName_,
                openid: this.openID_,
                gameName: dat.name,
                location: loc,
                appid: dat.appId,
                alias: dat.alias
            }

            this._common(url, data, null)

            console.log('[HDSDK] export stat', this.openID_, dat.appId, dat.id, dat.name)
        }
        else
            console.error('[HDSDK] _reportExportStat openId不存在，请保证openId的获取')
    }

    private static _common(url: string, data: any, sucCb: Function, failCb?: Function)
    {
        if(data == null)
        {
            console.error('[HttpRequest] failed')
            return
        }

        let sd = new SendData()
        sd.url = url

        if(typeof data == 'object')
        {
            for (const key in data) {
                if (data.hasOwnProperty(key)) {
                    const val = data[key];
                    if(val == null)
                        continue

                    if(sd.data != '')
                        sd.data += '&'
                    
                    if(typeof val == 'object')
                    {
                        let str = JSON.stringify(val)
                        sd.data += key + '=' + encodeURI(str)
                    }
                    else if(typeof val == 'string' || typeof val == 'number' || typeof val == 'boolean')
                    {
                        sd.data += key + '=' + encodeURI(val.toString())
                    }
                    else
                    {
                        sd.data += key + '=' + encodeURI(val.toString())
                        console.warn('[HttpRequest] please check your data type,only support object,string,number or boolean')
                    }
                }
            }
        }
        else
            sd.data = encodeURI(<string>data)

        this._send(sd, sucCb, failCb)

        sd = null
    }

    private static _send(sendData: SendData, sucCb?: Function, failCb?: Function) 
    {
        let xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function () 
        {
            if (xhr.readyState == 4 && (xhr.status >= 200 && xhr.status < 400)) 
            {
                console.log('[HDSDK] req succ', xhr.responseText)

                if (sucCb)
                    sucCb(JSON.parse(xhr.responseText))
            }
            else if(xhr.status < 200 || xhr.status >= 400)
            {
                console.log('[HDSDK] conn', xhr.readyState, xhr.status)
            }
        };

        xhr.onerror = function()
        {
            console.log('[HDSDK] error', xhr.status)

            if (failCb)
                failCb()
        }

        let url = sendData.url + '?' + sendData.data
        xhr.open("GET", url, true);
        //xhr.setRequestHeader('content-type', 'application/json')
        xhr.send();
    }

    private static _compareVersionForWx(v1Str: String, v2Str: String) 
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

    private static _requstQueue(gridCb?: Function, likeCb?: Function, qrCb?: Function, bnrCb?: Function)
    {
        if(this.reqLimited_ < kMaxRequests && !this.bDownloaded_)
        {
            let rd = new ReqData()
            rd.gridCb = gridCb
            rd.likeCb = likeCb
            rd.qrCb = qrCb
            rd.bnrCb = bnrCb

            this.reqQue_.push(rd)

            console.log('[HDSDK] _requstQueue', this.reqQue_.length)
        }

        ++this.reqLimited_

        this._requestProc()
    }

    private static _requestProc()
    {
        let bReq = Date.now() - this.lastReqTime_ > kRequestTime
        if(bReq)
        {
            let rd = this.reqQue_.shift()
            if(rd)
            {
                this.lastReqTime_ = Date.now()

                this.currPage_ = 1
                this._fetchData(this.proName_, rd.gridCb, rd.likeCb, rd.qrCb, rd.bnrCb)

                clearTimeout(this.reqTimerId_)

                this.reqTimerId_ = setTimeout(this._requestProc.bind(this), kRequestInterval)

                console.log('[HDSDK] _requestProc', this.reqQue_.length)
            }
        }
    }

    private static _login(proName: string, gridCb?: Function, likeCb?: Function, qrCb?: Function, bnrCb?: Function)
    {
        wx.login({
            success: (loginRes: any) => {
                if(loginRes.code)
                {
                    wx.request({
                        url: kNetCfg.commServer + '/user/getSessionKey',
                        data: {
                            code: loginRes.code,
                            proName: proName,
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
                                console.log('[HDSDK] login request succ', res)

                                this.loginTime_ = Date.now()

                                let dat = JSON.parse(res.data.res)
                                if(dat && dat.openId)
                                {
                                    this.init(dat.openId, proName, gridCb, likeCb, qrCb, bnrCb)
                                }
                            }
                            else
                            {
                                console.log('[HDSDK] login request fail', res)

                                this.init('', proName, gridCb, likeCb, qrCb, bnrCb)
                            }
                        },
                        fail: (res: any) => {
                            console.log('[HDSDK] login request error', res)
                        },
                    })
                }
            },
            fail: (loginRes: any) => {
                console.log('[HDSDK] wx login error', loginRes)

                this.init('', proName, gridCb, likeCb, qrCb, bnrCb)
            },
            complete: (loginRes: any) => {
                
            }
        })
    }

    private static get _isMinigamePlat()
    {
        return typeof wx !== 'undefined'
    }
}
