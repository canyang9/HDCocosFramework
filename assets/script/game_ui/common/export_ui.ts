import { BaseUI, UIHierarchy } from "./base_ui";
import { HDMap } from "../../util/structure/hd_map";
import { G } from "../../util/global_def";
import { HDSDK, HDNavData } from "../../HDSDK";
import { DataHub } from "../../data/data_hub";
import { TipUI } from "./tip_ui";
import { DialogUI } from "./dialog_ui";
import { GameStorage, SaveDef } from "../../util/game_storage";
import { AudioMgrInst } from "../../util/audio_mgr";
import { WxUtil } from "../../util/wx_util";
import { GameUserInfo } from "../../game/user_info";
import { TimedTaskInst } from "../../util/timed_task";

//HDSDK 导出UI模块，将各式导出功能集成在一起，提供使用

//整体动效类型，用于界面开启时单个展示对象播放的动效和隔间多久播放动效
export enum ExportTransType {
    kNone,
    kPop,
    kFade,
    kSpring, 
    kShake,
}

const kMaxCheckCnt = 5

const kUploadLog = false //是否开启日志上报

const kMoveToTop = true //是否绑定组件时将其移到顶层容器中，这样组件不会被其他低层级的UI所阻挡（几乎在所有默认UI之上）

/**
 * 导出组件名，通过设定好的名字读取和使用组件，用户自行定义
 */
export class ExportUIName {
    static kSL1 = 'singleL1' //single left 1
    static kSL2 = 'singleL2' //single left 2
    static kSR1 = 'singleR1'
    static kSR2 = 'singleR2'

    static kHomeNS = 'homeNB'

    static kFake = 'fakeBtn'

    static kGSR1 = 'gsR1' //game single right
    static kGSR2 = 'gsR2'

    static kHT = 'horTop' //top horizal scroll
    static kHB = 'horBtm'

    static kResultNS = 'resNS'

    static kFP = 'foldPage' //home moregame button

    static kPop = 'pop'

    static kLike = 'like'
}

/**
 * 天幕专用，后台配置的导出广告位ID
 */
export class ExportTmID {
    //TMSDK export id
    static kFold = '1088929'
    static kPage = '1088828'
    static kHT = '1088727'
    static kLike = '1088626'
    static kSingles = '1086404'

    static kForce = '1089333'
    static kCancel = '1092262'
}

/**
 * 导出分组名预设，用户自定义
 */
export class ExportGroupName {
    static kHS4 = 'homeSingle4'
    static kHomeAll = 'homeAll'
    static kGS2 = 'gameSingle2'
    static kGameAll = 'gameAll'
}

/**
 * 导出组件分组，通过分组可以批量操作组件（如批量显示隐藏）
 * 需要预先在UI编辑器中摆放好预设展示位
 * 组名由用户自行定义
 */
export class ExportGroup {
    private static grpMap_ = new HDMap() //key：组名 value：标签数组

    private static exportUI_: ExportUI = null

    /**
     * 批量添加单个展示组成员
     * @param grpName 组名 
     * @param tags 单个展示控件标签名集合
     */
    static addMembers(grpName: string, tags: string[])
    {
        if(!this.exportUI_)
            this.exportUI_ = ExportUI.instance

        let arr = []
        if(this.grpMap_.containsKey(grpName))
        {
            arr = this.grpMap_.get(grpName)
        }

        for(let i = 0; i < tags.length; ++i)
        {
            arr.push(tags[i])
        }

        arr = G.uniqueArray(arr)

        if(!this.grpMap_.containsKey(grpName))
            this.grpMap_.put(grpName, arr)
    }

    /**
     * 展示组成员
     * @param grpName 组名 
     * @param log 上报日志信息，用于需要埋点测试的地方，进行相应的日志信息提交
     */
    static showMembers(grpName: string, log = '')
    {
        if(this.exportUI_ && this.grpMap_.containsKey(grpName))
        {
            let arr = this.grpMap_.get(grpName)
            for(let i = 0; i < arr.length; ++i)
            {
                this.exportUI_.show(arr[i], log, false)
            }

            if(kUploadLog)
            {
                ExportUI.instance.uploadLog(log, '展示')
            }
        }
    }

    /**
     * 天幕专用，展示组成员
     * @param grpName 组名
     * @param posId 天幕后台配置的导出广告位id
     */
    static showMembersTM(grpName: string, posId: string)
    {
        if(this.exportUI_ && this.grpMap_.containsKey(grpName))
        {
            let arr = this.grpMap_.get(grpName)
            for(let i = 0; i < arr.length; ++i)
            {
                this.exportUI_.showTM(arr[i], posId)
            }
        }
    }

    static hideMembers(grpName: string)
    {
        if(this.exportUI_ && this.grpMap_.containsKey(grpName))
        {
            let arr = this.grpMap_.get(grpName)
            for(let i = 0; i < arr.length; ++i)
            {
                this.exportUI_.hide(arr[i])
            }
        }
    }
}

export class ExportUI extends BaseUI {
    static instance = new ExportUI()

    private normArr_: HDNavData[] = [] //常规跳转数据列表（包括九宫格、猜你喜欢、二维码）
    private bnrArr_: HDNavData[] = [] //banner类跳转数据列表

    //创建出来的展示对象以键值对存放，键为用户自定义命名的tag，值为具体的展示对象实例
    private navObjMap_: HDMap = new HDMap()

    //用于更新展示对象的状态
    private singleNavArr_: SingleNav[] = []
    private singleBnrArr_: SingleNavBnr[] = []
    private rcShowArr_: RCShow[] = []

    private vPage_: VPageShow = null
    private hPage_: HPageShow = null

    private vGrid_: VGridPage = null

    private vFakePage_: VFakePage = null

    private invitePage_: InvitePage = null

    private showPageCb_: Function = null
    private hidePageCb_: Function = null

    private bnrShowId_ = ''

    private block_: FGUICom = null
    private blockBg_: FGUIImage = null

    private blockClickCb_: Function = null

    // private preloadQue_: string[] = []
    // private preloadCnt_ = 0
    // private preloadedCnt_ = 0
    // private preloadProcCbPara_ = 0
    // private preloadProcCb_: Function = null
    // private preloadCompleteCb_: Function = null

    private loadQue_: LoadInfo[] = []
    //由于多个导出位请求加载的icon可能是相同的，采用键值组来避免重复请求相同的icon资源
    private loadInfoMap_ = new HDMap() //key: url value: LoadInfo array
    //对于已经确认过下载成功的icon资源，无需再次请求，直接使用，loadInfoCompleteMap_即用来标记资源是否顺利下载成功
    private loadInfoCompleteMap_ = new HDMap() //key: url value: 1
    private currLoadInfo_: LoadInfo = null

    private tmSingleLoadMap_ = new HDMap() //key:tm pos id value: SingleNav array
    private tmSingleLoadRecMap_ = new HDMap() //key:tm pos id value: null or 1
    private tmSingleLoadDelay_ = 1
    private tmSingleLoadCnt_ = 0

    private normDatIdx_ = 0 //创建单个展示时从跳转数据列表中取值的下标参考
    private bnrDatIdx_ = 0

    private fetchTimer_ = 0
    private checkTimer_ = 0
    private preloaderTimer_ = 0

    private updCheckCnt_ = 0 //数据更新轮询次数，次数越高，检测频率越低
    private fetchCheckCnt_ = 0 //获取数据检测次数

    private cx_ = 0
    private cy_ = 0

    private bUpdCheck_ = false //检查是否有sdk数据更新，在几分钟内进行轮询
    private bFetchedData_ = false //是否获取到了跳转数据，一定频率轮询检测
    private bInited_ = false
    private bPreload_ = false

    private bLockShow_ = false //锁定显示，这个状态下无法显示任何导出组件

    private bForceFakePage_ = false //记录是否触发过强弹假微信页，已经弹出过的，下次暂时不再触发

    private tmPageDefaultPosId_ = '' //默认的tm独立页id，通常用于跳转取消时转入的独立页

    /**
     * 使用天幕SDK时，对于取消跳转进入独立页的情况，需要手动设置后台的广告位id
     */
    set defaultPageTmID(val: string)
    {
        this.tmPageDefaultPosId_ = val
    }

    /**
     * 获取常规跳转数据当前索引位
     */
    get normNavDataIndex()
    {
        return this.normDatIdx_
    }

    /**
     * 获取常规跳转数据集合
     */
    get normNavData()
    {
        return this.normArr_
    }

    /**
     * 初始化导出UI
     */
    init()
    {
        let bVerScreen = cc.view.getVisibleSize().height > cc.view.getVisibleSize().width
        let comName = bVerScreen ? 'VMainPnl' : 'HMainPnl'
        let com = fgui.UIPackage.createObject('HDSDK', comName).asCom

        if(com)
        {
            this.com_ = com
            com.setSize(cc.view.getVisibleSize().width, cc.view.getVisibleSize().height)

            this.cx_ = com.width * 0.5
            this.cy_ = com.height * 0.5

            if(bVerScreen)
            {
                this.vPage_ = new VPageShow()
                this.vGrid_ = new VGridPage()
            }
            else
            {
                this.hPage_ = new HPageShow()
            }

            this.invitePage_ = new InvitePage()

            com.sortingOrder = UIHierarchy.kExportCom
            BaseUI.root.addChild(com)

            this.block_ = com.getChild('block').asCom
            this.blockBg_ = this.block_.getChild('bg').asImage
            this.block_.visible = false

            this.bInited_ = true
        }
    }

    update(dt)
    {
        if(this.bInited_)
        {
            if(!this.bUpdCheck_)
            {
                if(G.isTMSDK)
                    this.bUpdCheck_ = true
                else
                {
                    if(!this.bFetchedData_)
                        this._fetchChecker(dt)

                    this._checkUpdate(dt)
                }
            }

            if(G.isTMSDK)
            {
                ++this.tmSingleLoadCnt_

                if(this.tmSingleLoadCnt_ >= this.tmSingleLoadDelay_ && 
                    this.tmSingleLoadMap_.size() > 0)
                {
                    this.tmSingleLoadMap_.each(this._tmLoadCallback.bind(this))

                    this.tmSingleLoadCnt_ = 0
                    if(this.tmSingleLoadDelay_ < 21600)
                        this.tmSingleLoadDelay_ *= 2
                }
            }

            for(let i = 0; i < this.singleNavArr_.length; ++i)
            {
                if(this.singleNavArr_[i].update(dt))
                {
                    let dat = this._getNextNormNavDat()
                    if(dat)
                    {
                        this.singleNavArr_[i].updateInfo(dat)
                    }
                }
            }

            for (let i = 0; i < this.singleBnrArr_.length; ++i) 
            {
                if (this.singleBnrArr_[i].update(dt))  
                {
                    let dat = this._getNextBnrNavDat()
                    if (dat)  
                    {
                        this.singleBnrArr_[i].updateInfo(dat)
                    }
                }
            }

            for(let i = 0; i < this.rcShowArr_.length; ++i)
            {
                this.rcShowArr_[i].update(dt)
            }

            if(this.vPage_)
                this.vPage_.update(dt)
            else if(this.hPage_)
                this.hPage_.update(dt)

            if(this.vGrid_)
                this.vGrid_.update(dt)
        }
    }

    /**
     * 获取参考物的坐标点
     * @param ref 参考节点
     */
    getRelativeXY(ref: FGUICom)
    {
        let pnt = new cc.Vec2()
        pnt = BaseUI.root.localToGlobal(ref.x, ref.y, pnt)
        pnt = this.com_.globalToLocal(pnt.x, pnt.y, pnt)

        return pnt
    }

    getCenterXY()
    {
        return { x: this.cx_, y: this.cy_ }
    }

    /**
     * 开启阻挡区域，适用于某些展示页面，如折叠页和弹出页
     * @param bShowBg 阻挡区域 
     * @param blockClickCb 阻挡区域点击回调
     */
    block(bShowBg = false, blockClickCb: Function = null)
    {
        this.block_.visible = true
        
        this.blockBg_.visible = bShowBg

        if(blockClickCb)
        {
            this.blockClickCb_ = blockClickCb
            
            this.block_.onClick(this._onBlockClick, this)
        }
    }

    unblock()
    {
        this.block_.visible = false
    }

    initPage()
    {
        if(this.vPage_)
            this.vPage_.init(this.normArr_, this.com_)
        else if(this.hPage_)
            this.hPage_.init(this.normArr_, this.bnrArr_, this.com_)
        
        if(this.vGrid_)
            this.vGrid_.init(this.normArr_, this.com_)

        if(this.invitePage_)
            this.invitePage_.init(this.normArr_, this.com_)
    }

    /**
     * 绑定一个假退出按钮
     * @param tag 假退出按钮标签名
     * @param parent 从什么父节点上获取节点绑定，默认在ExportUI自身节点上面获取
     * @param bFixedPos 是否固定位置，固定位置的情况下，按钮位置在微信平台上将根据右上角的菜单栏来确认位置，
     * 跟随在菜单栏下方，无视在工程中按钮摆放的位置，默认为是
     */
    bindFakeCloseButton(tag: string, parent: FGUICom = null, bFixedPos = true)
    {
        if(this.navObjMap_.containsKey(tag))
        {
            G.warn('[ExportUI bindFakeCloseButton] no need to bind repetitive nav object')
            return
        }

        let p = parent || this.com_
        let c = p.getChild(tag)
        if(c)
        {
            if(parent)
            {
                c.removeFromParent()
                this.com_.addChild(c)
            }
            let btn = new FakeCloseButton(c.asCom)

            if(!this.vFakePage_)
            {
                this.vFakePage_ = new VFakePage()
                this.vFakePage_.init(this.normNavData, this.com_)
            }

            if(G.isMinigamePlat && bFixedPos)
            {
                let rect = WxUtil.convertMenuButtonRect(0, c.height + 10)
                c.setPosition(rect.x, rect.y)
                c.setSize(rect.w, rect.h)
            }

            this.navObjMap_.put(tag, btn)
        }
        else
            G.warn('[ExportUI bindFakeCloseButton] not find component >', tag)
    }

    /**
     * 绑定更多好玩按钮
     * @param tag 更多好玩按钮标签名，如果有多个，请不要重名
     * @param parent 从什么父节点上获取节点绑定，默认在ExportUI自身节点上面获取
     * @param transType 按钮间隔播放的动效，0 不播放 1 旋转 2缩放
     * @param bTopRender 是否置顶渲染，默认是
     */
    bindMoreGameButton(tag: string, parent: FGUICom = null, transType = 0, bTopRender = true)
    {
        if(this.navObjMap_.containsKey(tag))
        {
            G.warn('[ExportUI bindMoreGameButton] no need to bind repetitive nav object')
            return
        }

        let p = parent || this.com_
        let c = p.getChild(tag)
        if(c)
        {
            if(parent && bTopRender)
            {
                c.removeFromParent()
                this.com_.addChild(c)
            }
            let btn = new MoreGameButton(c.asCom)
            if(transType > 0)
            {
                btn.playTrans(transType)
            }

            this.navObjMap_.put(tag, btn)
        }
        else
            G.warn('[ExportUI bindMoreGameButton] not find component >', tag)
    }

    /**
     * 绑定单个展示对象，利用已经摆放在UI上的预制控件，不带游戏名，天幕SDK下无效
     * @param tag 自定义展示标签，需要确保全局唯一性，用户自行管理，后续访问展示对象时可使用
     * @param parent 从什么父节点上获取节点绑定，默认在ExportUI自身节点上面获取
     * @param transType 展示对象采用的动效，默认无
     * @param sucCb 可选，击跳转成功回调
     * @param failCb 可选，点击跳转失败回调（包括
     * @param infoDura 展示多久后刷新信息，默认5s，-1为不更新
     * @param transDura 动效多久播放一次，默认5s
     * @param bFrame 是否带有底框，默认是
     */
    bindSingle(tag: string, parent: FGUICom = null, transType = ExportTransType.kNone, 
        sucCb: Function = null, failCb: Function = null, 
        infoDura = 5, transDura = 5, bFrame = true)
    {
        if(this.navObjMap_.containsKey(tag))
        {
            G.warn('[ExportUI bindSingle] no need to bind repetitive nav object')
            return
        }

        let p = parent || this.com_
        let c = p.getChild(tag)
        if(c)
        {
            if(parent && kMoveToTop)
            {
                c.removeFromParent()
                this.com_.addChild(c)
            }
            let sn = new SingleNav(c.asCom)

            let dat: HDNavData = null
            if(G.isTMSDK)
            {
                dat = new HDNavData()
            }
            else
            {
                dat = this._getNextNormNavDat()
            }

            if(dat)
            {
                sn.init(dat)
                sn.appendExtraFunc(sucCb, failCb, transType, infoDura, transDura)

                this.navObjMap_.put(tag, sn)
                this.singleNavArr_.push(sn)
            }
        }
        else
            G.warn('[ExportUI bindSingle] not find component >', tag)
    }

    /**
     * 绑定单个展示对象，利用已经摆放在UI上的预制控件，带游戏名，天幕SDK下无效
     * @param nameClr 游戏名文本颜色，除此之外其他参数含义与bindSingle一致
     * @param bNameBg 是否有游戏名背景条
     */
    bindSingleEx(tag: string, parent: FGUICom = null, transType = ExportTransType.kNone, sucCb: Function = null, failCb: Function = null, 
        infoDura = 5, transDura = 5, nameClr = '#000000', bFrame = true, bNameBg = false)
    {
        if(this.navObjMap_.containsKey(tag))
        {
            G.warn('[ExportUI bindSingleEx] no need to bind repetitive nav object')
            return
        }

        let p = parent || this.com_
        let c = p.getChild(tag)
        if(c)
        {
            if(parent && kMoveToTop)
            {
                c.removeFromParent()
                this.com_.addChild(c)
            }
            let sn = new SingleNavEx(c.asCom)

            let dat: HDNavData = null
            if(G.isTMSDK)
            {
                dat = new HDNavData()
            }
            else
            {
                dat = this._getNextNormNavDat()
            }

            if(dat)
            {
                sn.init(dat, bFrame, nameClr, bNameBg)
                sn.appendExtraFunc(sucCb, failCb, transType, infoDura, transDura)

                this.navObjMap_.put(tag, sn)
                this.singleNavArr_.push(sn)
            }
        }
        else
            G.warn('[ExportUI bindSingleEx] not find component >', tag)
    }

    /**
     * 绑定单个banner展示，利用已经摆放在UI上的预制控件
     */
    bindBanner(tag: string, parent: FGUICom = null, transType = ExportTransType.kNone, sucCb: Function = null, failCb: Function = null, 
        infoDura = 5, transDura = 5, bFrame = true)
    {
        if(this.navObjMap_.containsKey(tag))
        {
            G.warn('[ExportUI bindBanner] no need to bind repetitive nav object')
            return
        }

        let p = parent || this.com_
        let c = p.getChild(tag)
        if(c)
        {
            if(parent && kMoveToTop)
            {
                c.removeFromParent()
                this.com_.addChild(c)
            }
            let sn = new SingleNavBnr(c.asCom)

            let dat = this._getNextBnrNavDat()
            if(dat)
            {
                sn.init(dat)
                sn.appendExtraFunc(sucCb, failCb, transType, infoDura, transDura)

                this.navObjMap_.put(tag, sn)
                this.singleBnrArr_.push(sn)
            }
        }
        else
            G.warn('[ExportUI bindBanner] not find component >', tag)
    }

    /**
     * 绑定单个开始按钮展示，利用已经摆放在UI上的预制控件
     * 与其他单个展示不同的是，按钮层级不会置顶，而是融入在具体场景中，请在摆放预设控件时注意
     */
    bindButton(tag: string, parent: FGUICom = null, transType = ExportTransType.kNone, 
        sucCb: Function = null, failCb: Function = null, infoDura = 5, transDura = 5)
    {
        if(this.navObjMap_.containsKey(tag))
        {
            G.warn('[ExportUI bindButton] no need to bind repetitive nav object')
            return
        }

        let p = parent || this.com_
        let c = p.getChild(tag)
        if(c)
        {
            let sn = new ButtonNav(c.asCom)

            let dat = this._getNextNormNavDat()
            if(dat)
            {
                sn.init(dat)
                sn.appendExtraFunc(sucCb, failCb, transType, infoDura, transDura)

                this.navObjMap_.put(tag, sn)
                this.singleNavArr_.push(sn)
            }
        }
        else
            G.warn('[ExportUI bindBanner] not find component >', tag)
    }

    /**
     * 利用预设好的横向或垂直滚动展示栏生成不带名字的展示栏
     * @param tag 预设展示栏名字
     * @param parent 从什么父节点上获取节点绑定，默认在ExportUI自身节点上面获取
     * @param rp 行间距，只有垂直展示栏有效，只有一列
     * @param cp 列间距，只有横向展示栏有效，只有一行
     * @param navIdx 从第几条跳转数据开始展示，默认为0，最小为0，最大为跳转数据集合的长度减1
     * @param transType 单个展示位动效，默认无
     * @param sucCb 单个展示位跳转成功回调
     * @param failCb 单个展示位跳转失败回调
     * @param transDura 动效每隔多久播放一次，默认5s
     * @param bFrame 单个展示是否有底框，默认否
     * @param updDura 滚动时间间隔，默认2s
     */
    bindRCScroll(tag: string, parent: FGUICom = null, rp = 0, cp = 0, navIdx = 0,
        transType = ExportTransType.kNone, sucCb: Function = null, failCb: Function = null, 
        transDura = 5, bFrame = true, updDura = 2)
    {
        if(this.navObjMap_.containsKey(tag))
        {
            G.warn('[ExportUI bindRCScroll] no need to bind repetitive nav object')
            return
        }

        this._genRCScroll(tag, parent, rp, cp, navIdx, false, '', 
            transType, sucCb, failCb, transDura, bFrame, updDura)
    }

    /**
     * 利用预设好的横向或垂直滚动展示栏生成带名字的展示栏
     * 使用Ex后缀的预设方案，除了nameClr之外参数含义与bindRCScroll一致
     * @param nameClr 游戏名颜色，默认为控件预设颜色
     * @param rp 行间距建议设定为-10
     * @param bNameBg 是否有游戏名背景板
     */
    bindRCScrollEx(tag: string, parent: FGUICom = null, rp = -10, cp = 0, navIdx = 0, nameClr = '', 
        transType = ExportTransType.kNone,  sucCb: Function = null, failCb: Function = null, 
        transDura = 5, bFrame = true, updDura = 2, bNameBg = true)
    {
        if(this.navObjMap_.containsKey(tag))
        {
            G.warn('[ExportUI bindRCScroll] no need to bind repetitive nav object')
            return
        }

        this._genRCScroll(tag, parent, rp, cp, navIdx, true, nameClr, 
            transType, sucCb, failCb, transDura, bFrame, updDura, bNameBg)
    }

    /**
     * 利用预设好的猜你喜欢展示栏生成带游戏名的展示栏
     * @param tag 预设展示栏名字
     * @param parent 从什么父节点上获取节点绑定，默认在ExportUI自身节点上面获取
     * @param cp 列间距
     * @param navIdx 从第几条跳转数据开始展示，默认为0，最小为0，最大为跳转数据集合的长度减1
     * @param nameClr 游戏名颜色，默认为控件预设颜色
     * @param sucCb 单个展示位跳转成功回调
     * @param failCb 单个展示位跳转失败回调
     * @param updDura 滚动时间间隔，默认2s
     */
    bindGuessLike(tag: string, parent: FGUICom = null, cp = 10, navIdx = 0, nameClr = '', 
        sucCb: Function = null, failCb: Function = null, updDura = 2)
    {
        if(this.navObjMap_.containsKey(tag))
        {
            G.warn('[ExportUI bindGuessLike] no need to bind repetitive nav object')
            return
        }

        this._genRCScroll(tag, parent, 0, cp, navIdx, true, nameClr, 
            ExportTransType.kNone, sucCb, failCb, -1, false, 2, false, true)
    }

    /**
     * 利用预设好的垂直双列展示栏生成不带游戏名的展示栏
     * @param tag 预设展示栏名字
     * @param parent 从什么父节点上获取节点绑定，默认在ExportUI自身节点上面获取
     * @param rp 行间距，带名字展示建议使用-10
     * @param navIdx 从第几条跳转数据开始展示，默认为0，最小为0，最大为跳转数据集合的长度减1
     * @param updDura 展示信息刷新时间间隔，默认5s
     * @param transType 单个展示位动效，默认无
     * @param sucCb 单个展示位跳转成功回调
     * @param failCb 单个展示位跳转失败回调
     * @param transDura 动效每隔多久播放一次，默认5s
     * @param bFrame 单个展示是否有底框，默认否
     */
    bindVerDualCol(tag: string, parent: FGUICom = null, rp = 0, navIdx = 0, updDura = 5, 
        transType = ExportTransType.kNone, sucCb: Function = null, failCb: Function = null, 
        transDura = 5, bFrame = false)
    {
        if(this.navObjMap_.containsKey(tag))
        {
            G.warn('[ExportUI bindVerDualCol] no need to bind repetitive nav object')
            return
        }

        this._genVD(tag, parent, rp, navIdx, false, '', updDura, transType, sucCb, failCb, transDura, bFrame)
    }

    /**
     * 利用预设好的垂直双列展示栏生成带游戏名的展示栏
     * @param nameClr 游戏名颜色，默认控件预设颜色，除此外的参数与bindVerDualCol一致
     * @param rp 行间距建议设定为-15
     */
    bindVerDualColEx(tag: string, parent: FGUICom = null, rp = -15, navIdx = 0, nameClr = '', 
        updDura = 5, transType = ExportTransType.kNone,
        sucCb: Function = null, failCb: Function = null, transDura = 5, bFrame = false)
    {
        if(this.navObjMap_.containsKey(tag))
        {
            G.warn('[ExportUI bindVerDualColEx] no need to bind repetitive nav object')
            return
        }

        this._genVD(tag, parent, rp, navIdx, true, nameClr, updDura, transType, sucCb, failCb, transDura, bFrame)
    }

    /**
     * 利用预设好的2x4展示栏生成不带游戏名的展示栏
     * 与其他展示栏不同的是，渲染层级不会置顶，而是融入在具体场景中，请在摆放预设控件时注意
     * @param tag 预设展示栏名字
     * @param parent 从什么父节点上获取节点绑定，默认在ExportUI自身节点上面获取
     * @param rp 行间距
     * @param cp 列间距
     * @param updDura 展示信息刷新时间间隔，默认5s
     * @param transType 单个展示位动效，默认无
     * @param sucCb 单个展示位跳转成功回调
     * @param failCb 单个展示位跳转失败回调
     * @param transDura 动效每隔多久播放一次，默认5s
     * @param bTitle 是否显示展示栏标题，默认是
     * @param bFrame 单个展示是否有底框，默认否
     */
    bindGrid2x4(tag: string, parent: FGUICom = null, rp = 0, cp = 0, updDura = 5, 
        transType = ExportTransType.kNone, sucCb: Function = null, failCb: Function = null, 
        transDura = 5, bTitle = true, bFrame = false)
    {
        if(this.navObjMap_.containsKey(tag))
        {
            G.warn('[ExportUI bindGrid2x4] no need to bind repetitive nav object')
            return
        }

        this._genGrid(tag, parent, 2, 4, rp, cp, 0, false, '', transType, 
            sucCb, failCb, transDura, bFrame, bTitle, updDura)
    }

    /**
     * 利用预设好的2x4展示栏生成带游戏名的展示栏
     * @param nameClr 游戏名颜色
     */
    bindGrid2x4Ex(tag: string, parent: FGUICom = null, rp = -10, cp = 0, nameClr = '', updDura = 5, 
        transType = ExportTransType.kNone, sucCb: Function = null, failCb: Function = null,
        transDura = 5, bTitle = true, bFrame = false)
    {
        if(this.navObjMap_.containsKey(tag))
        {
            G.warn('[ExportUI bindGrid2x4Ex] no need to bind repetitive nav object')
            return
        }

        this._genGrid(tag, parent, 2, 4, rp, cp, 0, true, nameClr, transType, 
            sucCb, failCb, transDura, bFrame, bTitle, updDura)
    }

    /**
     * 利用预设好的2x3展示栏生成带游戏名的展示栏
     * @param nameClr 游戏名颜色
     * @param bBg 是否底板
     */
    bindGrid2x3Ex(tag: string, parent: FGUICom = null, rp = -10, cp = 0, nameClr = '', updDura = 5, 
        transType = ExportTransType.kNone, sucCb: Function = null, failCb: Function = null,
        transDura = 5, bTitle = true, bFrame = false, bBg = true)
    {
        if(this.navObjMap_.containsKey(tag))
        {
            G.warn('[ExportUI bindGrid2x4Ex] no need to bind repetitive nav object')
            return
        }

        this._genGrid(tag, parent, 2, 3, rp, cp, 0, true, nameClr, transType, 
            sucCb, failCb, transDura, bFrame, bTitle, updDura, true, bBg)
    }

    /**
     * 利用预设好的3x3展示栏生成不带游戏名的展示栏，用法与bindGrid2x4一致
     */
    bindGrid3x3(tag: string, parent: FGUICom = null, rp = 0, cp = 0, updDura = 5, 
        transType = ExportTransType.kNone, sucCb: Function = null, failCb: Function = null, 
        transDura = 5, bTitle = true, bFrame = false)
    {
        if(this.navObjMap_.containsKey(tag))
        {
            G.warn('[ExportUI bindGrid3x3] no need to bind repetitive nav object')
            return
        }

        this._genGrid(tag, parent, 3, 3, rp, cp, 0, false, '', transType, 
            sucCb, failCb, transDura, bFrame, bTitle, updDura)
    }

    /**
     * 利用预设好的3x3展示栏生成带游戏名的展示栏，用法与bindGrid2x4Ex一致
     */
    bindGrid3x3Ex(tag: string, parent: FGUICom = null, rp = -10, cp = 0, nameClr = '', updDura = 5, 
        transType = ExportTransType.kNone, sucCb: Function = null, failCb: Function = null, 
        transDura = 5, bTitle = true, bFrame = false)
    {
        if(this.navObjMap_.containsKey(tag))
        {
            G.warn('[ExportUI bindGrid3x3Ex] no need to bind repetitive nav object')
            return
        }

        this._genGrid(tag, parent, 3, 3, rp, cp, 0, true, nameClr, transType, 
            sucCb, failCb, transDura, bFrame, bTitle, updDura)
    }

    /**
     * 与bindGrid3x3本质上一致，但是Pop一般用于强行弹出的地方
     */
    bindPop3x3(tag: string, parent: FGUICom = null, rp = 0, cp = 0, updDura = 5, 
        transType = ExportTransType.kNone, sucCb: Function = null, failCb: Function = null, 
        transDura = 5, bTitle = true, bFrame = false)
    {
        if(this.navObjMap_.containsKey(tag))
        {
            G.warn('[ExportUI bindPop3x3] no need to bind repetitive nav object')
            return
        }

        this._genGrid(tag, parent, 3, 3, rp, cp, 0, false, '', transType, 
            sucCb, failCb, transDura, bFrame, bTitle, updDura, true)
    }

    /**
     * 与bindPop3x3Ex本质上一致，但是Pop一般用于强行弹出的地方
     */
    bindPop3x3Ex(tag: string, parent: FGUICom = null, rp = -10, cp = 0, nameClr = '', updDura = 5, 
        transType = ExportTransType.kNone, sucCb: Function = null, failCb: Function = null, 
        transDura = 5, bTitle = true, bFrame = false)
    {
        if(this.navObjMap_.containsKey(tag))
        {
            G.warn('[ExportUI bindPop3x3Ex] no need to bind repetitive nav object')
            return
        }

        this._genGrid(tag, parent, 3, 3, rp, cp, 0, true, nameClr, transType, 
            sucCb, failCb, transDura, bFrame, bTitle, updDura, true)
    }


    bindPop4x3Ex(tag: string, parent: FGUICom = null, rp = -10, cp = 0, nameClr = '', updDura = 5,
        transType = ExportTransType.kNone, sucCb: Function = null, failCb: Function = null,
        transDura = 5, bTitle = true, bFrame = false) 
    {
        if (this.navObjMap_.containsKey(tag)) 
        {
            G.warn('[ExportUI bindPop4x3Ex] no need to bind repetitive nav object')
            return
        }

        this._genGrid(tag, parent, 4, 3, rp, cp, 0, true, nameClr, transType,
            sucCb, failCb, transDura, bFrame, bTitle, updDura, true)
    }

    /**
     * 绑定折叠页，不带游戏名展示
     * @param tag 预设展示栏名字
     * @param parent 从什么父节点上获取节点绑定，默认在ExportUI自身节点上面获取
     * @param c 列数，可以选择2或者3
     * @param rp 行间距
     * @param cp 列间距
     * @param foldCb 由展开到折叠后的回调
     * @param unfoldCb 由折叠到展开后的回调
     * @param iconScl 图标缩放比例，默认为1，如果需要展示更大的图标而不变动底框尺寸时，可以考虑设置此值
     * @param bMirror 是否镜像，一般折叠页是放在屏幕左侧，如果需要 放在右侧，那么使用镜像来进行绑定
     * @param updDura 图标滚动更新时间间隔，默认2s
     * @param transType 单个展示位动效，默认无
     * @param sucCb 单个展示位跳转成功回调
     * @param failCb 单个展示位跳转失败回调
     * @param transDura 动效每隔多久播放一次，默认5s
     * @param bFrame 单个展示是否有底框，默认否
     */
    bindFoldPage(tag: string, parent: FGUICom = null, c = 3, rp = -10, cp = 0, 
        foldCb: Function = null, unfoldCb: Function = null, iconScl = 1, bMirror = false,
        updDura = 2, transType = ExportTransType.kNone, 
        sucCb: Function = null, failCb: Function = null, transDura = 5, bFrame = false)
    {
        if(this.navObjMap_.containsKey(tag))
        {
            G.warn('[ExportUI bindFoldPage] no need to bind repetitive nav object')
            return
        }

        this._genFoldPage(tag, parent, c, rp, cp, 0, false, '', transType, sucCb, failCb, 
            iconScl, bMirror, transDura, bFrame, updDura, foldCb, unfoldCb)
    }

    /**
     * 绑定折叠页，带游戏名展示，参数含义与bindFoldPage一致
     * @param nameClr 游戏名颜色
     */
    bindFoldPageEx(tag: string, parent: FGUICom = null, c = 3, rp = -10, cp = 0, nameClr = '',
        foldCb: Function = null, unfoldCb: Function = null, iconScl = 1, bMirror = false, 
        updDura = 2, transType = ExportTransType.kNone, 
        sucCb: Function = null, failCb: Function = null, transDura = 5, bFrame = false)
    {
        if(this.navObjMap_.containsKey(tag))
        {
            G.warn('[ExportUI bindFoldPage] no need to bind repetitive nav object')
            return
        }

        this._genFoldPage(tag, parent, c, rp, cp, 0, true, nameClr, transType, sucCb, failCb, 
            iconScl, bMirror, transDura, bFrame, updDura, foldCb, unfoldCb)
    }

    show(tag: string, log = '', bUpload = true)
    {
        if(this.bLockShow_)
            return

        if(DataHub.config.export === 1)
            this._setVisible(tag, true, log, bUpload)
        else
            this._setVisible(tag, false)
    }

    /**
     * 天幕专用，展示导出位
     * @param tag 导出位名
     * @param posId 天幕后台导出位广告ID
     * 用法：
     * ExportUIInst.showTM(ExportUIName.kXX, ExportTmID.kX)
     */
    showTM(tag: string, posId: string)
    {
        if(this.bLockShow_ || !G.isTMSDK)
            return

        if(DataHub.config.export === 1)
        {
            if(this.navObjMap_.containsKey(tag))
            {
                console.log('[ExportUI showTM] ', tag, posId)

                let obj = this.navObjMap_.get(tag)
                obj.showTM(posId)
            }
            else
                G.warn('[ExportUI showTM] not found this component', tag)
        }
        else
            this._setVisible(tag, false)
    }

    hide(tag: string)
    {
        this._setVisible(tag, false)
    }

    /** 隐藏所有导出位 */
    hideAll()
    {
        this.navObjMap_.each((i, k, v)=>{
            v.hide()
        })
    }

    /** 锁住显示操作，调用show不会显示任何导出位 */
    lockShowOpt()
    {
        this.bLockShow_ = true
    }

    /** 解锁显示操作 */
    unlockShowOpt()
    {
        this.bLockShow_ = false
    }

    /**
     * 添加独立页的回调，需要手动销毁
     * 通常用于游戏过程中展示页面的情况，比如需要展示时暂停游戏进程
     * @param showCb 显示时的回调
     * @param hideCb 隐藏时的回调
     */
    addPageCallback(showCb: Function, hideCb: Function)
    {
        this.showPageCb_ = showCb
        this.hidePageCb_ = hideCb
    }

    clearShowPageCallback()
    {
        this.showPageCb_ = null
        this.hidePageCb_ = null
    }

    /**
     * 添加独立页面的banner展示id，用于独立页banner误点开启时，在下方展示对应的banner
     * 需要手动销毁，只有在当日还可以进行banner误点的情况下生效
     * 用户需要自行准备对应位置上的banner，设计分辨率720*1280下，banner跟随节点可以采用1100px，上下居中适配
     * @param bnrId 要展示banner id
     */
    setPageBannerID(bnrId: string)
    {
        this.bnrShowId_ = bnrId
    }

    clearPageBannerID()
    {
        this.bnrShowId_ = ''
    }

    getPageBannerID()
    {
        return this.bnrShowId_
    }

    /**
     * 显示独立页面，一般无需手动调用
     */
    showPage(log = '', tmPosId = '')
    {
        if(G.isTMSDK)
        {
            if(tmPosId == '')
                tmPosId = this.tmPageDefaultPosId_

            if(this.tmPageDefaultPosId_ == '')
            {
                console.warn('[ExportUI showPage] tm sdk default page id is not existed')
                return
            }
            
            if(this.vPage_)
                this.vPage_.showTM(tmPosId)
            else if(this.hPage_)
                this.hPage_.showTM(tmPosId)
        }
        else
        {
            if(this.vPage_)
                this.vPage_.show(log)
            else if(this.hPage_)
                this.hPage_.show(log)
        }

        if(this.showPageCb_)
        {
            this.showPageCb_()
        }
    }

    hidePage()
    {
        if(this.vPage_)
            this.vPage_.hide()
        else if(this.hPage_)
            this.hPage_.hide()

        if(this.hidePageCb_)
            this.hidePageCb_()
    }

    /**
     * 展示网格独立页面，一般无需手动调用
     */
    showGridPage(log = '', tmPosId = '')
    {
        if(G.isTMSDK)
        {
            if(tmPosId == '')
                tmPosId = this.tmPageDefaultPosId_

            if(this.tmPageDefaultPosId_ == '')
            {
                console.warn('[ExportUI showPage] tm sdk default page id is not existed')
                return
            }

            if(this.vGrid_)
                this.vGrid_.showTM(tmPosId)
            else //如果不存在格子页面，则展示常规的独立页面
            {
                this.showPage('', tmPosId)
            }
        }
        else
        {
            if(this.vGrid_)
                this.vGrid_.show(log)
            else //如果不存在格子页面，则展示常规的独立页面
            {
                this.showPage(log)
            }
        }

        if(this.showPageCb_)
        {
            this.showPageCb_()
        }
    }

    hideGridPage()
    {
        if(this.vGrid_)
            this.vGrid_.hide()
        else    //如果不存在格子页面，则隐藏常规的独立页面
            this.hidePage()

        if(this.hidePageCb_)
            this.hidePageCb_()
    }

    showFakePage(log = '', tmPosId = '')
    {
        if(G.isTMSDK)
        {
            if(tmPosId == '')
                tmPosId = this.tmPageDefaultPosId_

            if(this.tmPageDefaultPosId_ == '')
            {
                console.warn('[ExportUI showPage] tm sdk default page id is not existed')
                return
            }

            if(this.vFakePage_)
                this.vFakePage_.showTM(tmPosId)
        }
        else
        {
            if(this.vFakePage_)
                this.vFakePage_.show(log)
        }

        AudioMgrInst.pauseMusic()

        if(this.showPageCb_)
        {
            this.showPageCb_()
        }
    }

    hideFakePage()
    {
        if(this.vFakePage_)
            this.vFakePage_.hide()

        AudioMgrInst.resumeMusic()

        if(this.hidePageCb_)
            this.hidePageCb_()
    }

    showInvitePage(log = '', tmPosId = '')
    {
        if(G.isTMSDK)
        {
            if(tmPosId == '')
                tmPosId = this.tmPageDefaultPosId_

            if(this.tmPageDefaultPosId_ == '')
            {
                console.warn('[ExportUI showInvitePage] tm sdk default page id is not existed')
                return
            }

            if(this.invitePage_)
                this.invitePage_.showTM(tmPosId)
        }
        else
        {
            if(this.invitePage_)
                this.invitePage_.show(log)
        }
    }

    /**
     * 自动弹出折叠页
     * @param tag 折叠页名
     */
    autoPopFoldPage(tag: string)
    {
        if(this.navObjMap_.containsKey(tag))
        {
            let fp = this.navObjMap_.get(tag) as FoldPageShow
            fp.autoUnfold()
        }
    }

    /**
     * 收起折叠页
     * @param tag 折叠页名
     */
    closeFoldPage(tag: string)
    {
        if(this.navObjMap_.containsKey(tag))
        {
            let fp = this.navObjMap_.get(tag) as FoldPageShow
            fp.fold();
        }
    }

    //上报阿拉丁数据
    uploadLog(key: string, value: string)
    {
        // if(G.isMinigamePlat && key !== '')
        // {
        //     window["wx"].aldSendEvent(key, { '操作': value })
        //     // G.log('[ExportUI] upload ald Log', key, value)
        // }
    }

    /**
     * 小游戏跳转，微信环境下生效，相对于直接调用HDSDK的跳转，此接口能够提供本地模拟测试功能
     * @param dat 传入跳转数据
     * @param sucCb 可选参数，玩家点击确认跳转后的回调
     * @param failCb 可选参数，玩家点击取消跳转后的回调
     */
    navigate(dat: HDNavData, sucCb?: Function, failCb?: Function)
    {
        if(G.isMinigamePlat)
        {
            HDSDK.navigate(dat.id, sucCb, failCb)
        }
        else
        {
            if(dat.type === 3)
            {
                TipUI.instance.show('跳转模拟 二维码展示 ' + dat.name)
            }
            else
            {
                DialogUI.instance.renderSortTop()
                DialogUI.instance.show('跳转模拟', '是否跳转' + dat.name, sucCb, failCb)
            }
        }
    }

    /**
     * 天幕SDK跳转，仅微信环境下生效
     * @param posId 天幕后台广告位id
     * @param cid 跳转使用的创意id，由通过posId拉取到的返回数据中获得\
     * @param refreshCb 点击跳转后，需要设置点击刷新回调，用于刷新icon和跳转数据，否则无法保障下次的跳转是否正确
     * @param sucCb 跳转成功回调
     * @param failCb 跳转失败或取消跳转回调
     */
    navigateTM(posId: string, cid: string, refreshCb?: Function, sucCb?: Function, failCb?: Function)
    {
        if(G.isTMSDK)
        {
            console.log('[ExportUI navigateTM] nav trigger', posId, cid)

            wx.tmSDK.flowNavigate({
                positionId: posId, // 广告位id, 请先使用该id获取推广创意列表
                creativeId: cid,  // 传入获取到的creativeId
            }).then((newList) => {
                console.log('[ExportUI navigateTM] nav judgement')

                if(newList.navigateMessage)
                {
                    let msg = newList.navigateMessage.errMsg as string
                    if(msg.indexOf('ok') !== -1)
                    {
                        console.log('[ExportUI navigateTM] nav ok', msg)

                        if(sucCb)
                            sucCb()
                    }
                    else
                    {
                        console.log('[ExportUI navigateTM] nav error or cancel', msg)

                        if(failCb)
                            failCb()
                    }
                }

                if(refreshCb)
                    refreshCb(newList.creatives, posId)
                
            }).catch((error) => {
                console.log('[ExportUI navigateTM] nav error', error)
            })
        }
        else
        {
            console.log('[ExportUI navigateTM] not wx platform')
        }
    }

    //无需手动调用，导出系统自用
    addToLoadQueue(info: LoadInfo)
    {
        if(this.loadInfoMap_.containsKey(info.url))
        {
            let arr = this.loadInfoMap_.get(info.url)
            if(this.loadInfoCompleteMap_.containsKey(info.url))
            {
                if(info.completeCallback)
                    info.completeCallback()

                for(let i = 0; i < arr.length; ++i)
                {
                    if(arr[i].completeCallback)
                        arr[i].completeCallback()
                }

                this.loadInfoMap_.put(info.url, [])
            }
            else
            {
                arr.push(info)
            }
        }
        else
        {
            let arr = []
            arr.push(info)

            this.loadInfoMap_.put(info.url, arr)

            this.loadQue_.push(info)
        }

        if(!this.currLoadInfo_)
        {
            this.currLoadInfo_ = this.loadQue_.shift()
            if(this.currLoadInfo_)
            {
                cc.loader.load(this.currLoadInfo_.url, null, (err, res: cc.Texture2D)=> {
                    if(err)
					{
					}
					else
                        this._loadComplete()
				})
            }
        }
    }

    //无需手动调用，天幕拉取数据专用
    addToTmSingleQueue(posId: string, navItem: SingleNav)
    {
        if(this.tmSingleLoadMap_.containsKey(posId))
        {
            let arr = this.tmSingleLoadMap_.get(posId) as Array<SingleNav>

            let bPush = true
            //过滤数据
            for(let i = 0; i < arr.length; ++i)
            {
                if(navItem.navData.tmCid != '' && arr[i].navData == navItem.navData)
                {
                    bPush = false
                    break
                }
            }

            if(bPush)
                arr.push(navItem)
        }
        else
        {
            let arr = []
            arr.push(navItem)

            this.tmSingleLoadMap_.put(posId, arr)
        }

        this.tmSingleLoadDelay_ = 1
        if(this.tmSingleLoadRecMap_.containsKey(posId))
            this.tmSingleLoadRecMap_.remove(posId)
    }

    private _tmLoadCallback(i: number, posId: string, navArr: SingleNav[])
    {
        if(this.tmSingleLoadRecMap_.containsKey(posId))
            return

        wx.tmSDK.getFlowConfig({
            positionId: posId
        }).then((config) => {
            if(config.isOpen)
            {
                let cArr = config.creatives
                if(cArr)
                {
                    let idx = 0
                    for(let i = 0; i < navArr.length; ++i)
                    {
                        if(cArr[i].show_config)
                        {
                            navArr[i].navData.img = cArr[i].show_config.image
                            navArr[i].navData.name = cArr[i].show_config.title
                        }

                        navArr[i].navData.tmPosId = cArr[i].positionId
                        navArr[i].navData.tmCid = cArr[i].creativeId

                        navArr[i].updateInfo(navArr[i].navData)
                        navArr[i].registerTMSDKRefreshCallback(this._tmSdkSingleRefresh.bind(this))

                        ++idx
                        if(idx >= cArr.length)
                        {
                            idx = 0
                        }
                    }
                }
            }
        })

        this.tmSingleLoadRecMap_.put(posId, 1)
    }

    private _tmSdkSingleRefresh(creatives: any, posId: string)
    {
        if(this.tmSingleLoadMap_.containsKey(posId))
        {
            let navArr = this.tmSingleLoadMap_.get(posId)
            let cArr = creatives
            if(cArr)
            {
                let idx = 0
                for(let i = 0; i < navArr.length; ++i)
                {
                    if(cArr[i].show_config)
                    {
                        navArr[i].navData.img = cArr[i].show_config.image
                        navArr[i].navData.name = cArr[i].show_config.title
                    }

                    navArr[i].navData.tmPosId = cArr[i].positionId
                    navArr[i].navData.tmCid = cArr[i].creativeId

                    navArr[i].updateInfo(navArr[i].navData)

                    ++idx
                    if(idx >= cArr.length)
                    {
                        idx = 0
                    }
                }
            }
        }
        else
        {
            console.warn('[ExportUI _tmSdkSingleRefresh] tm single loading items is not existed', posId)
        }
    }

    private _loadComplete()
    {
        if(this.currLoadInfo_ && this.currLoadInfo_.completeCallback)
        {
            this.loadInfoCompleteMap_.put(this.currLoadInfo_.url, 1)

            if(this.loadInfoMap_.containsKey(this.currLoadInfo_.url))
            {
                // console.log('_loadComplete callback', this.currLoadInfo_.url)

                let arr = this.loadInfoMap_.get(this.currLoadInfo_.url)
                for(let i = 0; i < arr.length; ++i)
                {
                    if(arr[i].completeCallback)
                        arr[i].completeCallback()
                }

                this.loadInfoMap_.put(this.currLoadInfo_.url, [])
            }

            this.currLoadInfo_ = this.loadQue_.shift()
            if(this.currLoadInfo_)
            {
                // console.log('_loadComplete next', this.currLoadInfo_.url)

                cc.loader.load(this.currLoadInfo_.url, null, (err, res: cc.Texture2D)=> {
                    if(err)
                    {

                    }
                    else
                        this._loadComplete()
                })
            }
        }
    }

    private _genRCScroll(tag: string, parent = null, rp = 0, cp = 0, navIdx = 0, bName = false, nameClr = '', 
        transType = ExportTransType.kNone,  sucCb: Function = null, failCb: Function = null, 
        transDura = 5, bFrame = false, updDura = 2, bNameBg = true, bLike = false)
    {
        let p = parent || this.com_
        let c = p.getChild(tag)
        if(c)
        {
            if(parent && kMoveToTop)
            {
                c.removeFromParent()
                this.com_.addChild(c)
            }

            let com = c.asCom
            let bHor = com.width > com.height
            let rc: RCShow = null
            if(bHor)
            {
                if(bLike)
                    rc = new GuessLikeShow(com)
                else
                    rc = new HorShow(com)
                rc.setNameBgVisible(bNameBg);
                rc.init(this.normArr_, 1, 5, 0, cp, bName, bFrame, updDura, nameClr, navIdx)
                rc.buildSingles()
               
                rc.appendExtraFunc(sucCb, failCb, transType, transDura)
            }
            else
            {
                rc = new VerShow(com)
                rc.init(this.normArr_, 0, 1, rp, 0, bName, bFrame, updDura, nameClr, navIdx)
                rc.buildSingles()
                rc.appendExtraFunc(sucCb, failCb, transType, transDura)
            }

            if(rc)
            {
                this.navObjMap_.put(tag, rc)
                this.rcShowArr_.push(rc)
            }
        }
        else
            G.warn('[ExportUI _genRCScroll] not find component >', tag)
    }

    private _genVD(tag: string, parent = null, rp = 0, navIdx = 0, bName = false, nameClr = '', 
        updDura = 5, transType = ExportTransType.kNone,
        sucCb: Function = null, failCb: Function = null, transDura = 5, bFrame = false)
    {
        let p = parent || this.com_
        let c = p.getChild(tag)
        if(c)
        {
            if(parent && kMoveToTop)
            {
                c.removeFromParent()
                this.com_.addChild(c)
            }

            let com = c.asCom
            let vd = new VerShowD(com)
            
            vd.init(this.normArr_, 3, 2, rp, 0, bName, bFrame, updDura, nameClr, navIdx)
            vd.buildSingles()
            vd.appendExtraFunc(sucCb, failCb, transType, transDura)
            
            this.navObjMap_.put(tag, vd)
            this.rcShowArr_.push(vd)
        }
        else
            G.warn('[ExportUI _genVD] not find component >', tag)
    }

    //row 行 col列数
    private _genGrid(tag: string, parent = null, row = 0, col = 0, rp = 0, cp = 0, navIdx = 0, bName = false, nameClr = '', 
        transType = ExportTransType.kNone, sucCb: Function = null, failCb: Function = null, 
        transDura = 5, bFrame = false, bTitle = false, updDura = 5, bPop = true, bBg = true)
    {
        let p = parent || this.com_
        let c = p.getChild(tag)
        if(c)
        {
            if(bPop && parent && kMoveToTop)
            {
                c.removeFromParent()
                this.com_.addChild(c)
            }

            let com = c.asCom
            let grid: GridShow = null

            if(row === 3 && col === 3)
            {
                if(bPop)
                    grid = new Pop3x3(com)
                else
                    grid = new GridShow3x3(com)
            }
            else if(row === 2 && col === 4)
            {
                grid = new GridShow2x4(com)
            } 
            else if(row === 2 && col === 3)
            {
                grid = new GridShow2x3(com)
            }
            else if(row === 4 && col === 3)
            {
                if(bPop)
                    grid = new Pop4x3(com)
                else
                    grid = new GridShow4x3(com)
            }

            if(grid)
            {
                grid.init(this.normArr_, row, col, rp, cp, bName, bFrame, updDura, nameClr, navIdx, bBg)
                grid.buildSingles()
                grid.appendExtraFunc(sucCb, failCb, transType, transDura)

                if(bTitle)
                    grid.showTitle()
                else
                    grid.hideTitle()
                
                this.navObjMap_.put(tag, grid)
                this.rcShowArr_.push(grid)
            }
        }
        else
            G.warn('[ExportUI _genGrid] not find component >', tag)
    }

    private _genFoldPage(tag: string, parent = null, col = 0, rp = 0, cp = 0, navIdx = 0, bName = false, nameClr = '', 
        transType = ExportTransType.kNone, sucCb: Function = null, failCb: Function = null, iconScl = 1, bMirror = false,
        transDura = 5, bFrame = false, updDura = 5, foldCb: Function = null, unfoldCb: Function = null)
    {
        let p = parent || this.com_
        let c = p.getChild(tag)
        if(c)
        {
            if(parent && kMoveToTop)
            {
                c.removeFromParent()
                this.com_.addChild(c)
            }

            let com = c.asCom
            let fp = new FoldPageShow(com)

            if(fp)
            {
                fp.init(this.normArr_, 3, col, rp, cp, bName, bFrame, updDura, nameClr, navIdx, iconScl, bMirror)
                fp.buildSingles()
                fp.appendExtraFunc(sucCb, failCb, transType, transDura, foldCb, unfoldCb)
                
                this.navObjMap_.put(tag, fp)
                this.rcShowArr_.push(fp)
            }
        }
        else
            G.warn('[ExportUI _genFoldPage] not find component >', tag)
    }

    private _setVisible(tag: string, bVal: boolean, log = '', bUpload = false)
    {
        if(this.navObjMap_.containsKey(tag))
        {
            let obj = this.navObjMap_.get(tag)
            if(bVal)
            {
                obj.show(log, bUpload)
            }
            else
            {
                obj.hide()
            }
        }
        else
            G.warn('[ExportUI setVisible] not found this component', tag)
    }

    private _fetchChecker(dt)
    {
        this.fetchTimer_ -= dt
        if(this.fetchTimer_ <= 0)
        {
            if(HDSDK.isDataExisted)
            {
                this._fillData()

                this.bFetchedData_ = true
                this.bUpdCheck_ = true

                this.checkTimer_ = 3
            }
            else
            {
                this.fetchTimer_ = 1 + this.fetchCheckCnt_ * 2
                ++this.fetchCheckCnt_

                G.log('[HDSDK UI] fetch data count', this.fetchCheckCnt_)
            }
        }
    }

    private _checkUpdate(dt)
    {
        if(this.updCheckCnt_ < kMaxCheckCnt)
        {
            this.checkTimer_ -= dt
            if(this.checkTimer_ <= 0)
            {
                if(HDSDK.needUpdateNavData)
                {
                    this._fillData()

                    this.bUpdCheck_ = true
                }
                else
                {
                    ++this.updCheckCnt_
                    this.checkTimer_ = 3 + this.updCheckCnt_ * 5
                }
            }
        }
        else
            this.bUpdCheck_ = true
    }

    private _fillData()
    {
        this.normArr_ = this.normArr_.concat(HDSDK.getGridArray())
        let likeArr = HDSDK.getLikeArray()
        let arr = []
        if(likeArr && likeArr.length > 0)
        {
            for(let i = 0; i < this.normArr_.length; ++i) //unique
            {
                let nd = this.normArr_[i]
                for(let j = 0; j < likeArr.length; ++j)
                {
                    if(nd.sn != likeArr[j].sn && nd.type != likeArr[j].type)
                    {
                        arr.push(likeArr[j])
                    }
                }
            }

            if(arr.length > 0)
                this.normArr_ = this.normArr_.concat(arr)
        }

        this.normArr_ = this.normArr_.concat(HDSDK.getQRCodeArray())
        this.bnrArr_ = this.bnrArr_.concat(HDSDK.getBannerArray())
    }

    private _getNextNormNavDat()
    {
        let ret = null

        if(this.normArr_[this.normDatIdx_])
        {
            ret = this.normArr_[this.normDatIdx_]

            ++this.normDatIdx_
            if(this.normDatIdx_ >= this.normArr_.length)
                this.normDatIdx_ = 0
        }

        return ret
    }

    private _getNextBnrNavDat()
    {
        let ret = null

        if(this.bnrArr_[this.bnrDatIdx_])
        {
            ret = this.bnrArr_[this.bnrDatIdx_]

            ++this.bnrDatIdx_
            if(this.bnrDatIdx_ >= this.bnrArr_.length)
                this.bnrDatIdx_ = 0
        }

        return ret
    }

    private _onBlockClick()
    {
        if(this.blockClickCb_)
        {
            this.blockClickCb_()
            this.blockClickCb_ = null

            this.block_.offClick(this._onBlockClick, this)
        }
    }
}

export const ExportUIInst = ExportUI.instance

class FakeCloseButton {
    private com_: FGUICom = null

    private log_ = ''

    private tmPosId_ = ''

    constructor(com: FGUICom)
    {
        if(com)
        {
            this.com_ = com

            this.com_.onClick(this._onClick, this)

            this.hide()
        }
    }

    show(log = '')
    {
        if(this.com_)
        {
            this.com_.visible = true
        }

        if(kUploadLog)
        {
            this.log_ = log
        }
    }

    showTM(posId: string)
    {
        this.tmPosId_ = posId

        this.show()
    }

    hide()
    {
        if(this.com_)
        {
            this.com_.visible = false
        }
    }

    private _onClick()
    {
        if(this.com_)
        {
            ExportUI.instance.showFakePage(this.log_, this.tmPosId_)
        }
    }
}

class MoreGameButton {
    private com_: FGUICom = null

    private redPnt_: FGUICom = null

    private rotTrans_: FGUITrans = null
    private sclTrans_: FGUITrans = null

    private showTrans_: FGUITrans = null
    private hideTrans_: FGUITrans = null

    private lastTrans_: FGUITrans = null

    private log_ = ''

    private tmPosId_ = ''

    constructor(com: FGUICom)
    {
        if(com)
        {
            this.com_ = com

            let rp = com.getChild('redPnt')
            if(rp)
                this.redPnt_ = rp.asCom

            this.rotTrans_ = com.getTransition('rot')
            this.sclTrans_ = com.getTransition('scl')

            this.showTrans_ = com.getTransition('show')
            this.hideTrans_ = com.getTransition('hide')

            com.onClick(this._onClick, this)

            this.hide()
        }
    }

    show(log = '')
    {
        if(this.com_)
        {
            if (this.showTrans_) 
                this.showTrans_.play()
            
            this.com_.visible = true
        }

        if(kUploadLog)
        {
            this.log_ = log
        }
    }

    showTM(posId: string)
    {
        this.tmPosId_ = posId

        this.show()
    }

    hide()
    {
        if(this.com_)
        {
            if (this.hideTrans_) {
                this.hideTrans_.play()
            }
            
            this.com_.visible = false
        }
    }

    /**
     * 播放动效
     * @param t 1 旋转 2 缩放
     */
    playTrans(t: number)
    {
        if(this.lastTrans_)
            this.lastTrans_.stop()

        if(t === 1)
        {
            this.rotTrans_.play(null, -1)
            this.lastTrans_ = this.rotTrans_
        }
        else if(t === 2)
        {
            this.sclTrans_.play(null, -1)
            this.lastTrans_ = this.sclTrans_
        }
    }

    private _onClick()
    {
        if(this.com_)
        {
            if(G.randRange(0, 100) <= DataHub.config.exportPageTypeProb)
                ExportUIInst.showPage(this.log_, this.tmPosId_)
            else
                ExportUIInst.showGridPage(this.log_, this.tmPosId_)
        }
    }
}

class LoadInfo {
    url = ''

    completeCallback: Function = null

    constructor(url: string, cb: Function)
    {
        this.url = url
        this.completeCallback = cb
    }
}

const kSWid = 140 //单个跳转位宽度
const kSHgt = 140 //单个跳转位高度

const kSNWid = 145 //单个跳转位带游戏名高度
const kSNHgt = 180 //单个跳转位带游戏名高度

//单个展示不带游戏名
class SingleNav {
    protected com_: FGUICom = null

    protected grp_: FGUIGroup = null

    protected bgImg_: FGUIImage = null
    protected iconLdr_: FGUILoader = null
    protected tag_: FGUIImage = null

    protected popTrans_: FGUITrans = null
    protected fadeTrans_: FGUITrans = null
    protected springTrans_: FGUITrans = null
    protected tagTrans_: FGUITrans = null
    protected shakeTrans_:FGUITrans=null;

    protected navDat_: HDNavData = null
    protected navSucCb_: Function = null
    protected navFailCb_: Function = null

    //天幕SDK需要在点击跳转后更新对应区域的所有icon，通过注册统一的回调完成
    protected tmRefreshCb_: Function = null

    protected redPnt_: FGUICom=null
    protected origScl_ = 0

    protected transType_ = ExportTransType.kNone
    protected infoDura_ = -1 //持续展示多久后更新，-1不会更新
    protected transDura_ = -1 //动效多久播放一次，-1不播放

    protected updTimer_ = 0 //更新信息计时器
    protected transTimer_ = 0
    protected tagTimer_ = 0

    protected log_ = ''

    protected bCancelJumpActive_ = true

    constructor(com: FGUICom, bNoClick = false)
    {
        if(com)
        {
            this.com_ = com

            this.bgImg_ = com.getChild('bgImg').asImage
            this.iconLdr_ = com.getChild('iconLdr').asLoader
            this.tag_ = com.getChild('tag').asImage

            this.grp_ = com.getChild('grp').asGroup

            this.popTrans_ = com.getTransition('pop')
            this.fadeTrans_ = com.getTransition('fade')
            this.springTrans_ = com.getTransition('spring')
            this.tagTrans_ = com.getTransition('tag')
            this.shakeTrans_=com.getTransition('shake');
          
            this.redPnt_ = com.getChild('redPnt').asCom

            this.randShowRedPoint()
            
            this.origScl_ = com.width / kSWid

            if(!bNoClick)
                com.onClick(this._onClick, this)

            com.visible = false
        }
    }

    get origScale() 
    {
        return this.origScl_
    }

    set alpha(val: number)
    {
        if(this.grp_)
            this.grp_.alpha = val
    }

    get navData()
    {
        return this.navDat_
    }

    /**
     * 初始化单个展示
     * @param dat 传入HDSDK跳转数据
     * @param bFrame 是否显示底框，默认为是
     */
    init(dat: HDNavData, bFrame = true, nameClr = '', bNameBg = true)
    {
        if(this.com_)
        {
            this.iconLdr_.url = 'ui://CommUI/iconHolder'

            this.navDat_ = dat

            if(dat.img != '')
            {
                let info = new LoadInfo(dat.img, this._onLoadedImg.bind(this))
                ExportUI.instance.addToLoadQueue(info)
            }

            this.tag_.visible = dat.tag === 1
            this.bgImg_.visible = bFrame
        }
    }

    /**
     * 添加附加的一些功能参数，比如点击跳转后失败处理回调
     * @param navSucCb 跳转成功回调
     * @param navFailCb 跳转失败（取消）回调
     * @param tt 动效播放种类，默认无
     * @param infoDura 展示多久后更新跳转信息，默认5s，-1为不更新
     * @param tranDura 多久播放一次动效，默认5s
     * @param log 上报日志用的日志键值名，默认无
     */
    appendExtraFunc(navSucCb?: Function, navFailCb?: Function, tt = ExportTransType.kNone, infoDura = 5, transDura = 5)
    {
        this.navSucCb_ = navSucCb
        this.navFailCb_ = navFailCb
        this.transType_ = tt
        this.infoDura_ = G.isTMSDK ? -1 : infoDura
        this.transDura_ = transDura
    }

    /**
     * 根据类型播放动效
     * @param t 动效类型
     */
    playTrans(t: ExportTransType)
    {
        if(t === ExportTransType.kPop && this.popTrans_)
        {
            this.popTrans_.play()
        }
        else if(t === ExportTransType.kFade && this.fadeTrans_)
        {
            this.fadeTrans_.play()
        }
        else if(t === ExportTransType.kSpring && this.springTrans_)
        {
            this.springTrans_.play()
        }
        else if(t===ExportTransType.kShake && this.shakeTrans_)
        {
            this.shakeTrans_.play();
        }
    }

    /**
     * 添加到父节点上面，左上角为组件锚点
     * @param parent 父节点
     * @param x 相对父节点原点的x坐标
     * @param y 相对父节点原点的y坐标
     * @param scl 组件缩放值，默认为-1
     * @param nameClr 名字文本颜色，只有带名字时生效
     */
    addToParent(parent: FGUICom, x: number, y: number, scl = -1, nameClr = '')
    {
        if(this.com_)
        {
            if(scl !== -1)
            {
                this.com_.setSize(kSWid * scl, kSHgt * scl)
            }

            this.com_.visible = false
            this.com_.x = x
            this.com_.y = y

            parent.addChild(this.com_)
        }
    }

    updateInfo(dat: HDNavData)
    {
        if(this.com_)
        {
            if(G.isTMSDK)
            {
                let info = new LoadInfo(dat.img, this._onLoadedImg.bind(this))
                ExportUI.instance.addToLoadQueue(info)
            }
            else
                this.iconLdr_.url = dat.img
            this.tag_.visible = dat.tag === 1

            this.navDat_ = dat

            this.tagTimer_ = 0
        }
    }

    moveXY(offsetX = 0, offsetY = 0)
    {
        if(this.com_)
        {
            this.com_.x += offsetX
            this.com_.y += offsetY
        }
    }

    /**
     * 调整位置宽高
     * @param x 相对父节点的坐标x
     * @param y 相对父节点的坐标y
     */
    adjustXY(x: number, y: number)
    {
        if(this.com_)
        {
            this.com_.setPosition(x, y)
        }
    }

    /**
     * 调整尺寸
     * @param scl 缩放值，-1代表不改变大小
     */
    adjustSize(scl = -1)
    {
        if(this.com_ && scl != -1)
        {
            this.com_.setSize(kSWid * scl, kSHgt * scl)

            this.origScl_ = scl
        }
    }

    randShowRedPoint()
    {
        if (this.redPnt_) 
        {
            this.redPnt_.visible = G.randRange(0, 100) >= 70 ? true : false
        }
    }

    show(log = '', bUpload = true)
    {
        if(this.com_)
            this.com_.visible = true

        if(kUploadLog)
        {
            this.log_ = log
            if(bUpload)
                ExportUI.instance.uploadLog(this.log_, '展示')
        }
    }

    showTM(posId: string)
    {
        ExportUIInst.addToTmSingleQueue(posId, this)

        if(this.com_)
            this.com_.visible = true
    }

    hide()
    {
        if(this.com_)
            this.com_.visible = false

        this.reset()
    }

    reset()
    {
        this.popTrans_.stop()
        this.fadeTrans_.stop()
        this.springTrans_.stop()

        this.transTimer_ = 0
        this.updTimer_ = 0
        this.tagTimer_ = 0
    }

    /**
     * 更新组件行为，如间隔播放动画
     * @param dt 
     * @returns 是否更新跳转信息
     */
    update(dt)
    {
        let bRet = false

        if(this.com_.visible)
        {
            if(this.transType_ != ExportTransType.kNone && this.transDura_ !== -1)
            {
                this.transTimer_ += dt
                if(this.transTimer_ >= this.transDura_)
                {
                    this.playTrans(this.transType_)
                    this.transTimer_ = 0
                } 
            }

            if(this.infoDura_ != -1)
            {
                this.updTimer_ += dt
                if(this.updTimer_ >= this.infoDura_)
                {
                    bRet = true
                    this.updTimer_ = 0
                }
            }

            if(this.tag_.visible)
            {
                this.tagTimer_ += dt
                if(this.tagTimer_ >= 5)
                {
                    this.tagTrans_.play()
                    this.tagTimer_ = 0
                }
            }
        }

        return bRet
    }

    clickTrigger()
    {
        this._onClick()
    }

    /**
     * 设置是否激活取消跳转
     * @param bVal 
     */
    setCancelJumpActive(bVal = true)
    {
        this.bCancelJumpActive_ = bVal
    }

    registerTMSDKRefreshCallback(cb: Function)
    {
        if(G.isTMSDK)
            this.tmRefreshCb_ = cb
    }

    protected _onLoadedImg()
    {
        if(this.navDat_)
            this.iconLdr_.url = this.navDat_.img
    }

    protected _tmRefreshCallbackTrigger(creatives: any, posId: string)
    {
        if(this.tmRefreshCb_)
        {
            this.tmRefreshCb_(creatives, posId)
        }
    }

    protected _onClick()
    {
        if(this.navDat_)
        {
            if(G.isTMSDK)
            {
                ExportUIInst.navigateTM(this.navDat_.tmPosId, this.navDat_.tmCid, 
                    this._tmRefreshCallbackTrigger.bind(this), 
                    this._onNavSucc.bind(this), this._onNavFail.bind(this))
            }
            else
                ExportUIInst.navigate(this.navDat_, this._onNavSucc.bind(this), this._onNavFail.bind(this))

            if(kUploadLog && this.log_ !== '')
            {
                ExportUI.instance.uploadLog(this.log_, '点击按钮')
            }
        }
    }

    protected _onNavSucc()
    {
        if(this.navSucCb_)
            this.navSucCb_()

        if(kUploadLog && this.log_ !== '')
        {
            ExportUI.instance.uploadLog(this.log_, '确认跳转')
        }
    }

    protected _onNavFail()
    {
        if(this.navFailCb_)
            this.navFailCb_()

        if(this.bCancelJumpActive_)
        {
            if(G.randRange(0, 100) <= DataHub.config.exportPageTypeProb)
                ExportUIInst.showPage('取消跳转弹出独立页面')
            else
                ExportUIInst.showGridPage('取消跳转弹出独立页面')
        }

        if(kUploadLog && this.log_ !== '')
        {
            ExportUI.instance.uploadLog(this.log_, '取消跳转')
        }
    }
}

const kNameLblSizeL = 24
const kNameLblSize = 18
const kNameBgCnt = 3

//单个展示带游戏名
class SingleNavEx extends SingleNav {
    protected nameLbl_: FGUITextField = null
    protected nameBgs_: FGUIObj[] = []
    protected curNameBg_: FGUIObj = null
    protected bNameBg_ = false

    constructor(com: FGUICom, bNoClick = false)
    {
        super(com, bNoClick)

        if (com)  
        {
            this.origScl_ = com.width / kSNWid

            this.nameLbl_ = com.getChild('nameLbl').asTextField

            for (let i = 0; i < kNameBgCnt; i++) 
            {
                let bg = com.getChild('nameBg' + (i + 1)).asImage
                if (bg) 
                {
                    this.nameBgs_[i] = bg
                    bg.visible = false
                }
            }

            let r = G.randRange(0, this.nameBgs_.length - 1)
            for (let index = 0; index < this.nameBgs_.length; index++) 
            {
                let obj = this.nameBgs_[index]
                if (obj) 
                {
                    if (index === r) 
                    {
                        this.curNameBg_ = obj
                        this.curNameBg_.visible = true
                    } 
                    else  
                    {
                        obj.visible = false
                    }
                }
            }
        }
    }

    init(dat: HDNavData, bFrame = true, nameClr = '', bNameBg = true)
    {
        if(this.com_)
        {
            super.init(dat, bFrame)

            this.bNameBg_ = bNameBg

            if (this.curNameBg_) 
            {
                this.curNameBg_.visible = bNameBg;
            }
           
            this.nameLbl_.text = dat.name
            let fs = bNameBg ? kNameLblSize : kNameLblSizeL
            this.nameLbl_.fontSize = Math.round(fs * this.origScl_)

            if(nameClr != '')
            {
                let r = parseInt(nameClr.substr(0, 2), 16)
                let g = parseInt(nameClr.substr(2, 2), 16)
                let b = parseInt(nameClr.substr(2, 2), 16)

                this.nameLbl_.color = new cc.Color(r, g, b, 255)
            }
        }
    }

    addToParent(parent: FGUICom, x: number, y: number, scl = 1)
    {
        if(this.com_)
        {
            if(scl !== -1)
            {
                this.com_.setSize(kSNWid * scl, kSNHgt * scl)
            }

            this.com_.visible = false
            this.com_.setPosition(x, y)

            parent.addChild(this.com_)

            let fs = this.bNameBg_ ? kNameLblSize : kNameLblSizeL
            this.nameLbl_.fontSize = Math.round(fs * this.origScl_)
        }
    }

    adjustSize(scl = -1)
    {
        if(this.com_ && scl !== -1)
        {
            this.com_.setSize(kSNWid * scl, kSNHgt * scl)

            let fs = this.bNameBg_ ? kNameLblSize : kNameLblSizeL
            this.nameLbl_.fontSize = Math.round(fs * this.origScl_)

            this.origScl_ = scl
        }
    }

    updateInfo(dat: HDNavData)
    {
        super.updateInfo(dat)

        if(this.com_)
        {
            this.nameLbl_.text = dat.name
        }
    }
}

const kBNWid = 310 //单个条幅宽度
const kBNHgt = 120 //单个条幅高度

//单个banner展示
class SingleNavBnr extends SingleNav {
    constructor(com: FGUICom, bNoClick = false)
    {
        super(com, bNoClick)

        this.origScl_ = com.width / kBNWid
    }

    init(dat: HDNavData, bFrame = true, nameClr = '')
    {
        if(this.com_)
        {
            this.iconLdr_.url = 'ui://CommUI/iconHolder'

            this.navDat_ = dat
            
            if(dat.img != '')
            {
                let info = new LoadInfo(dat.bnrUrl, this._onLoadedImg.bind(this))
                ExportUI.instance.addToLoadQueue(info)
            }

            this.tag_.visible = dat.tag === 1
            this.bgImg_.visible = bFrame
        }
    }

    addToParent(parent: FGUICom, x: number, y: number, scl = 1, nameClr = '')
    {
        if(this.com_)
        {
            if(scl !== -1)
            {
                this.com_.setSize(kBNWid * scl, kBNHgt * scl)
            }

            this.com_.visible = false
            this.com_.setPosition(x, y)

            parent.addChild(this.com_)
        }
    }

    adjustSize(scl = -1)
    {
        if(this.com_ && scl !== -1)
        {
            this.com_.setSize(kBNWid * scl, kBNHgt * scl)

            this.origScl_ = scl
        }
    }

    updateInfo(dat: HDNavData)
    {
        if(this.com_)
        {
            if(G.isTMSDK)
            {
                let info = new LoadInfo(dat.img, this._onLoadedImg.bind(this))
                ExportUI.instance.addToLoadQueue(info)
            }
            else
                this.iconLdr_.url = dat.bnrUrl
            this.tag_.visible = dat.tag === 1

            this.navDat_ = dat

            this.tagTimer_ = 0
        }
    }

    protected _onLoadedImg()
    {
        if(this.navDat_)
            this.iconLdr_.url = this.navDat_.bnrUrl
    }
}

const kNSWid = 240
const kNSHgt = 100

//开始按钮型单个展示
class ButtonNav extends SingleNav {
    constructor(com: FGUICom, bNoClick = false)
    {
        super(null)

        if(com)
        {
            this.com_ = com

            this.iconLdr_ = com.getChild('iconLdr').asLoader

            this.grp_ = com.getChild('grp').asGroup

            this.popTrans_ = com.getTransition('pop')
            this.fadeTrans_ = com.getTransition('fade')
            this.springTrans_ = com.getTransition('spring')
            this.tagTrans_ = com.getTransition('tag')

            this.origScl_ = com.width / kNSWid

            if(!bNoClick)
                com.onClick(this._onClick, this)

            com.visible = false
        }
    }

    init(dat: HDNavData, bFrame = true, nameClr = '')
    {
        if(this.com_)
        {
            this.iconLdr_.url = 'ui://CommUI/iconHolder'

            this.navDat_ = dat

            if(dat.img != '')
            {
                let info = new LoadInfo(dat.img, this._onLoadedImg.bind(this))
                ExportUI.instance.addToLoadQueue(info)
            }
        }
    }

    updateInfo(dat: HDNavData)
    {
        if(this.com_)
        {
            if(G.isTMSDK)
            {
                let info = new LoadInfo(dat.img, this._onLoadedImg.bind(this))
                ExportUI.instance.addToLoadQueue(info)
            }
            else
                this.iconLdr_.url = dat.img

            this.navDat_ = dat
        }
    }

    addToParent(parent: FGUICom, x: number, y: number, scl = 1, nameClr = '')
    {
        if(this.com_)
        {
            if(scl !== -1)
            {
                this.com_.setSize(kNSWid * scl, kNSHgt * scl)
            }

            this.com_.visible = false
            this.com_.setPosition(x, y)

            parent.addChild(this.com_)
        }
    }

    adjustSize(scl = -1)
    {
        if(this.com_ && scl !== -1)
        {
            this.com_.setSize(kNSWid * scl, kNSHgt * scl)

            this.origScl_ = scl
        }
    }

    update(dt)
    {
        let bRet = false

        if(this.com_.visible)
        {
            if(this.transType_ != ExportTransType.kNone && this.transDura_ !== -1)
            {
                this.transTimer_ += dt
                if(this.transTimer_ >= this.transDura_)
                {
                    this.playTrans(this.transType_)
                    this.transTimer_ = 0
                } 
            }

            if(this.infoDura_ != -1)
            {
                this.updTimer_ += dt
                if(this.updTimer_ >= this.infoDura_)
                {
                    bRet = true
                    this.updTimer_ = 0
                }
            }
        }

        return bRet
    }
}

/** 假退出页面的单个展示位 */
class FakeNav extends SingleNav {
    private nameLbl_: FGUITextField = null

    constructor(com: FGUICom, bNoClick = false)
    {
        super(null)

        if(com)
        {
            this.com_ = com

            this.iconLdr_ = com.getChild('iconLdr').asLoader
            this.tag_ = com.getChild('tag').asImage

            this.nameLbl_ = com.getChild('nameLbl').asTextField

            if(!bNoClick)
                com.onClick(this._onClick, this)

            com.visible = false
        }
    }

    /**
     * 初始化单个展示
     * @param dat 传入HDSDK跳转数据
     * @param bFrame 是否显示底框，默认为是
     */
    init(dat: HDNavData, bFrame = true, nameClr = '')
    {
        if(this.com_)
        {
            this.iconLdr_.url = 'ui://CommUI/iconHolder'

            this.navDat_ = dat

            if(dat.img != '')
            {
                let info = new LoadInfo(dat.img, this._onLoadedImg.bind(this))
                ExportUI.instance.addToLoadQueue(info)
            }

            this.tag_.visible = dat.tag === 1
            
            this.nameLbl_.text = dat.name
        }
    }

    appendExtraFunc(navSucCb?: Function, navFailCb?: Function, tt = ExportTransType.kNone, infoDura = 5, transDura = 5)
    {
        this.navSucCb_ = navSucCb
        this.navFailCb_ = navFailCb
    }

    playTrans(t: ExportTransType)
    {
        
    }

    addToParent(parent: FGUICom, x: number, y: number, scl = -1, nameClr = '')
    {
        if(this.com_)
        {
            this.com_.visible = false
            this.com_.setPosition(x, y)

            parent.addChild(this.com_)
        }
    }

    updateInfo(dat: HDNavData)
    {
        if(this.com_)
        {
            if(G.isTMSDK)
            {
                let info = new LoadInfo(dat.img, this._onLoadedImg.bind(this))
                ExportUI.instance.addToLoadQueue(info)
            }
            else
                this.iconLdr_.url = dat.img
            this.tag_.visible = dat.tag === 1
            this.nameLbl_.text = dat.name

            this.navDat_ = dat
        }
    }

    moveXY(offsetX = 0, offsetY = 0)
    {
        
    }

    adjustXY(x: number, y: number)
    {
        
    }

    adjustSize(scl = -1)
    {
        
    }

    show(log = '', bUpload = true)
    {
        if(this.com_)
        {
            this.com_.visible = true
        }

        if(kUploadLog)
        {
            this.log_ = log
            if(bUpload)
                ExportUI.instance.uploadLog(this.log_, '展示')
        }
    }

    hide()
    {
        if(this.com_)
        {
            this.com_.visible = false
        }
    }

    reset()
    {
        
    }

    update(dt)
    {
        return false
    }

    protected _onLoadedImg()
    {
        if(this.navDat_)
            this.iconLdr_.url = this.navDat_.img
    }

    protected _onClick()
    {
        if(this.navDat_)
        {
            if(G.isTMSDK)
            {
                ExportUIInst.navigateTM(this.navDat_.tmPosId, this.navDat_.tmCid, 
                    this._tmRefreshCallbackTrigger.bind(this), 
                    this._onNavSucc.bind(this), this._onNavFail.bind(this))
            }
            else
                ExportUIInst.navigate(this.navDat_, this._onNavSucc.bind(this), this._onNavFail.bind(this))

            if(kUploadLog && this.log_ !== '')
            {
                ExportUI.instance.uploadLog(this.log_, '点击按钮')
            }
        }
    }

    protected _onNavSucc()
    {
        if(this.navSucCb_)
            this.navSucCb_()

        if(kUploadLog && this.log_ !== '')
        {
            ExportUI.instance.uploadLog(this.log_, '确认跳转')
        }
    }

    protected _onNavFail()
    {
        if(this.navFailCb_)
            this.navFailCb_()

        if(kUploadLog && this.log_ !== '')
        {
            ExportUI.instance.uploadLog(this.log_, '取消跳转')
        }
    }
}

const kLNWid = 100
const kLNHgt = 140

class LikeNavEx extends SingleNavEx {
    private mask_: FGUIGraph = null

    constructor(com: FGUICom, bNoClick = false)
    {
        super(null)

        if(com)
        {
            this.com_ = com

            this.bgImg_ = com.getChild('bgImg').asImage
            let ldr = com.getChild('iconLdr')
            if(ldr)
            {
                let c = ldr as FGUICom
                this.iconLdr_ = c.getChild('iconLdr').asLoader

                this.mask_ = c.getChild('mask').asGraph
            }
            this.tag_ = com.getChild('tag').asImage

            this.grp_ = com.getChild('grp').asGroup

            this.popTrans_ = com.getTransition('pop')
            this.fadeTrans_ = com.getTransition('fade')
            this.springTrans_ = com.getTransition('spring')
            this.tagTrans_ = com.getTransition('tag')
            this.shakeTrans_ = com.getTransition('shake')

            this.nameLbl_ = com.getChild('nameLbl').asTextField
          
            // this.redPnt_ = com.getChild('redPnt').asCom

            // this.randShowRedPoint()
            
            this.origScl_ = com.width / kLNWid

            if(!bNoClick)
                com.onClick(this._onClick, this)

            com.visible = false
        }
    }

    addToParent(parent: FGUICom, x: number, y: number, scl = 1)
    {
        if(this.com_)
        {
            if(scl !== -1)
            {
                this.com_.setSize(kLNWid * scl, kLNHgt * scl)
            }

            this.com_.visible = false
            this.com_.setPosition(x, y)

            parent.addChild(this.com_)

            let fs = this.bNameBg_ ? kNameLblSize : kNameLblSizeL
            this.nameLbl_.fontSize = Math.round(fs * this.origScl_)
        }
    }

    adjustSize(scl = -1)
    {
        if(this.com_ && scl !== -1)
        {
            this.com_.setSize(kLNWid * scl, kLNHgt * scl)

            let fs = this.bNameBg_ ? kNameLblSize : kNameLblSizeL
            this.nameLbl_.fontSize = Math.round(fs * this.origScl_)

            this.origScl_ = scl
        }
    }

    playTrans(t: ExportTransType)
    {

    }
}

const kSNCHgt = 200
const kCntTxtColor = '#333333'

class CountNav extends SingleNavEx {
    private cntLbl_: FGUITextField = null

    constructor(com: FGUICom, bNoClick = false)
    {
        super(com, bNoClick)

        this.cntLbl_ = com.getChild('cntLbl').asTextField
    }

    /**
     * 随机人数文本
     * @param bLarge 是否从大范围中取值
     */
    randomCount(bLarge = true)
    {
        let cnt = ''
        if(bLarge)
            cnt = G.randRange(90, 300).toString()
        else
            cnt = G.randRangeF(0.5, 3).toFixed(2)

        this.cntLbl_.text = cnt + '万人在玩'
    }

    addToParent(parent: FGUICom, x: number, y: number, scl = 1)
    {
        if(this.com_)
        {
            if(scl !== -1)
            {
                this.com_.setSize(kSNWid * scl, kSNCHgt * scl)
            }

            this.com_.visible = false
            this.com_.setPosition(x, y)

            parent.addChild(this.com_)

            let fs = this.bNameBg_ ? kNameLblSize : kNameLblSizeL
            this.nameLbl_.fontSize = Math.round(fs * this.origScl_)
        }
    }

    adjustSize(scl = -1)
    {
        if(this.com_ && scl !== -1)
        {
            this.com_.setSize(kSNWid * scl, kSNCHgt * scl)

            let fs = this.bNameBg_ ? kNameLblSize : kNameLblSizeL
            this.nameLbl_.fontSize = Math.round(fs * this.origScl_)

            this.origScl_ = scl
        }
    }
}

const kHorWid = 580 //1行4列的原始宽度
const kHorHgt = 160 //1行4列不带游戏名的原始高度
const kHorNHgt = 200 //1行4列带游戏名的原始宽度
const kVerWid = 160 //4行1列的原始宽度
const kVerHgt = 580 //4行1列不带游戏名的原始宽度
const kVerNhgt = 700 //4行1列带游戏名的原始宽度
const kRCSide = 10 //上下左右4个侧边的宽度
const kRatedRC = 5 //额定个数

const kRCMissClick = true //是否开启行列展示的滑动误点

//行列展示
class RCShow {
    protected com_: FGUICom = null
    protected clipArea_: FGUICom = null

    protected scrollArea_: FGUICom = null

    protected row_ = 0
    protected col_ = 0

    protected rowPitch_ = 0 //行距
    protected colPitch_ = 0 //列距

    protected wid_ = 0
    protected hgt_ = 0

    //辅助缩放比例，用来做一些位置偏移的辅助，比如横向展示栏高度变化之后，
    //横向会有一些坐标偏移或者尺寸的微调，利用这个缩放比来计算
    protected helpScl_ = 0 
    protected origScl_ = 0 //原始缩放比例，不同的展示栏计算方式不同，比如横向展示栏以高度作为计算凭据

    protected moveDist_ = 0

    protected updDura_ = 0 //展示多久后滚动

    protected updTimer_ = 0 //计时器

    protected navItemArr_: SingleNav[] = []

    protected navDatArr_: HDNavData[] = []
    protected navDatIdx_ = 0 //跳转数据取值索引

    protected log_ = ''

    protected nameClr_ = ''

    protected bScroll_ = false //是否开始滚动
    protected bName_ = false
    protected bFrame_ = false
    protected bNameBg_ = true

    protected missDownX_ = -1
    protected missDownY_ = -1
    protected bMissingClick_ = false

    constructor(com: FGUICom)
    {
        if(com)
        {
            this.com_ = com

            com.visible = false
            
            let ca = com.getChild('clipFrame')
            if(ca)
            {
                this.clipArea_ = ca.asCom

                this.clipArea_.on(fgui.Event.SCROLL, this._onScrolling, this)
                this.clipArea_.on(fgui.Event.SCROLL_END, this._onScrollEnd, this)

                this.scrollArea_ = this.clipArea_;
                
                //注册了Event.SCROLL后会派发一次，导致onScrolling在update更新一次之后会执行到，bScroll_被设置为true，无法自动滚动
                //此处设置一个定时器恢复bScroll_状态
                TimedTaskInst.add(()=>{ this.bScroll_ = false }, 0.5)

                this.wid_ = com.width
                this.hgt_ = com.height
            }
        }
    }    

    /**
     * 初始化行列
     * @param navDatArr 跳转数据集合
     * @param r 行数
     * @param c 列数
     * @param rp 行间距，默认为0
     * @param cp 列间距，默认为0
     * @param bName 是否带名字展示，默认不带
     * @param bFrame 是否带边框，默认不带
     * @param updDura 多久后滚动一次，默认2s
     * @param nameClr 名字颜色，默认为控件自带颜色
     * @param navIdx 跳转数据索引，从第几个数据开始展示，默认为0
     */
    init(navDatArr: HDNavData[], r = 1, c = 4, rp = 0, cp = 0, 
        bName = false, bFrame = false, updDura = 2, nameClr = '', navIdx = 0)
    {
        this.navDatArr_ = navDatArr
        if(navIdx < 0)
            navIdx = 0
        else if(navIdx > navDatArr.length)
            navIdx = navDatArr.length > 0 ? navDatArr.length - 1 : 0

        if (r === 2 && c === 3) 
            this.scrollArea_.scrollPane.touchEffect = false

        this.navDatIdx_ = navIdx
        
        this.row_ = r
        this.col_ = c

        this.rowPitch_ = rp
        this.colPitch_ = cp

        this.updDura_ = updDura
        this.nameClr_ = nameClr
        this.bName_ = bName
        this.bFrame_ = bFrame

        this.wid_ = this.com_.width
        this.hgt_ = this.com_.height
    }

    /**
     * 添加到父节点上面，左上角为组件锚点，要在初始化后调用
     * @param parent 父节点
     * @param x 相对父节点原点的x坐标
     * @param y 相对父节点原点的y坐标
     * @param scl 组件缩放值，默认为-1
     */
    addToParent(parent: FGUICom, x: number, y: number, scl = -1)
    {
        if(this.com_)
        {
            if(scl !== -1)
            {
                this.com_.setSize(this.wid_ * scl, this.hgt_ * scl)
                this.origScl_ = scl
            }

            this.com_.visible = false
            this.com_.setPosition(x, y)

            this.buildSingles()
            
            parent.addChild(this.com_)
        }
    }

    buildSingles()
    {
        
    }

    /**
     * 添加附加的一些功能参数，比如点击跳转后失败处理回调
     * @param navSucCb 跳转成功回调
     * @param navFailCb 跳转失败（取消）回调
     * @param tt 动效播放种类，默认无
     * @param tranDura 多久播放一次动效，默认5s
     * @param log 上报日志用的日志键值名，默认无
     */
    appendExtraFunc(navSucCb?: Function, navFailCb?: Function, tt = ExportTransType.kNone, transDura = 5)
    {
        for(let i = 0; i < this.navItemArr_.length; ++i)
        {
            this.navItemArr_[i].appendExtraFunc(navSucCb, navFailCb, tt, -1, G.randRange(1, transDura))
        }
    }

    /**
     * 调整位置宽高
     * @param x 相对父节点的坐标x
     * @param y 相对父节点的坐标y
     */
    adjustXY(x: number, y: number)
    {
        if(this.com_)
        {
            this.com_.setPosition(x, y)
        }
    }

    /**
     * 调整尺寸，改变尺寸会引起内部所有单个导出控件大小和间距变化，不要频繁修改
     * @param scl 缩放值，-1代表不改变大小
     */
    adjustSize(scl = -1)
    {
        if(this.com_ && scl != -1)
        {
            this.origScl_ = scl

            this.com_.setSize(this.wid_ * scl, this.hgt_ * scl)
        }
    }

    show(log = '', bUpload = false)
    {
        if(this.com_)
        {
            this.com_.visible = true

            this.scrollArea_.node.on(cc.Node.EventType.TOUCH_START, this._onDown, this)
            this.scrollArea_.node.on(cc.Node.EventType.TOUCH_MOVE, this._onMove, this)
            this.scrollArea_.node.on(cc.Node.EventType.TOUCH_END, this._onUp, this)
        }

        if(kUploadLog)
        {
            this.log_ = log
            if(bUpload)
                ExportUI.instance.uploadLog(this.log_, '展示')

            for(let i = 0; i < this.navItemArr_.length; ++i)
            {
                this.navItemArr_[i].show(log, false)
            }
        }
    }

    showTM(posId: string)
    {
        wx.tmSDK.getFlowConfig({
            positionId: posId
        }).then((config) => {
            if(config.isOpen)
            {
                console.log('[RCShow showTM] download data')

                let cArr = config.creatives
                if(cArr)
                {
                    this._tmSdkDataProc(cArr)

                    if(this.com_)
                    {
                        this.com_.visible = true

                        this.scrollArea_.node.on(cc.Node.EventType.TOUCH_START, this._onDown, this)
            			this.scrollArea_.node.on(cc.Node.EventType.TOUCH_MOVE, this._onMove, this)
            			this.scrollArea_.node.on(cc.Node.EventType.TOUCH_END, this._onUp, this)
                    }
                }
            }
        })
    }

    hide()
    {
        if(this.com_)
        {
            this.com_.visible = false
         
            this.scrollArea_.node.off(cc.Node.EventType.TOUCH_START, this._onDown, this)
            this.scrollArea_.node.off(cc.Node.EventType.TOUCH_MOVE, this._onMove, this)
            this.scrollArea_.node.off(cc.Node.EventType.TOUCH_END, this._onUp, this)
        }

        for(let i = 0; i < this.navItemArr_.length; ++i)
            this.navItemArr_[i].reset()

        this.updTimer_ = 0
    }

    update(dt)
    {
        if(this.com_.visible && this.navItemArr_.length > 0)
        {
            for(let i = 0; i < this.navItemArr_.length; ++i)
                this.navItemArr_[i].update(dt)

            if(!this.bScroll_)
            {
                this.updTimer_ += dt
                if(this.updTimer_ >= this.updDura_)
                {
                    if(G.isTMSDK)
                    {

                    }
                    else
                        this._randomInfo()

                    this.updTimer_ = 0
                }
            }
        }
    }

    protected _onDown(evt: cc.Event.EventTouch)
    {
        this.missDownX_ = evt.getLocationX()
        this.missDownY_ = evt.getLocationY()

        this.bMissingClick_ = false
    }

    protected _onMove(evt: cc.Event.EventTouch)
    {
        if(this.missDownX_ == -1 || this.missDownY_ == -1)
            return

        let offsetX = Math.abs(evt.getLocationX() - this.missDownX_)
        let offsetY = Math.abs(evt.getLocationY()- this.missDownY_)

        if((offsetX > 10 || offsetY > 10) && !this.bMissingClick_)
        {
            if(G.randRange(0, 100) <= DataHub.config.fakeBtnClick)
            {
                let mx = evt.getLocationX(),
                    my = evt.getLocationY()

                let lx = this.scrollArea_.localToGlobal().x,
                    ly = this.scrollArea_.localToGlobal().y,
                    lw = this.scrollArea_.width,
                    lh = this.scrollArea_.height

                if(my > ly && my < ly + lh && mx > lx && lx < lx + lw)
                {
                    let idx = this.scrollArea_.getFirstChildInView()

                    if(mx < lx)
                        mx = lx
                    else if(mx > lx + lw)
                        mx = lx + lw

                    if(my < ly)
                        my = ly
                    else if(my > ly + lh)
                        my = ly + lh

                    let divX = lw / this.col_
                    let divY = lh / this.row_
                    let ix = Math.floor((mx - lx) / divX)
                    let iy = Math.floor((my - ly) / divY)
                    let nav = this.navItemArr_[idx + ix + iy * 3]
                    if(nav)
                    {
                        nav.clickTrigger()
                    }
                }
            }

            this.bMissingClick_ = true
        }
    }

    protected _onUp()
    {
        this.missDownX_ = -1
        this.missDownY_ = -1

        this.bMissingClick_ = true
    }

    protected _randomInfo()
    {
        if(this.navDatArr_.length > 0)
        {
            this.navDatIdx_ = G.randRange(0, this.navDatArr_.length - 1)
            for(let i = 0; i < this.navItemArr_.length; ++i)
            {
                let dat = this._getNextNavData()
                if(dat)
                {
                    this.navItemArr_[i].updateInfo(dat)
                }
            }
        }
    }

    protected _createSingle(r: number, c: number, bName = false, bFrame = false, iconScl = 1)
    {
        let dat = this._getNextNavData()
        if(dat)
        {
            let scl = this.origScl_ * iconScl

            let nav: SingleNav = null
            if(bName)
            {
                let com = fgui.UIPackage.createObject('HDSDK', 'NavItemEx').asCom
                nav = new SingleNavEx(com)
                nav.init(dat, bFrame, this.nameClr_)
                nav.addToParent(this.clipArea_, (c * kSNWid + c * this.colPitch_) * scl, 
                    (r * kSNHgt + r * this.rowPitch_) * scl, scl)
                nav.show()
                nav.registerTMSDKRefreshCallback(this._tmRefreshCallback.bind(this))
            }
            else
            {
                let com = fgui.UIPackage.createObject('HDSDK', 'NavItem').asCom
                nav = new SingleNav(com)
                nav.init(dat, bFrame)
                nav.addToParent(this.clipArea_, (c * kSWid + c * this.colPitch_) * scl, 
                    (r * kSHgt + r * this.rowPitch_) * scl, scl)
                nav.show()
                nav.registerTMSDKRefreshCallback(this._tmRefreshCallback.bind(this))
            }

            if(nav)
                this.navItemArr_.push(nav)
        }
    }

    protected _tmRefreshCallback(creatives: any, posId: string)
    {
        let cArr = creatives
        if(cArr)
        {
            console.log('[RCShow _tmRefreshCallback]')

            this._tmSdkDataProc(cArr)
        }
    }

    protected _tmSdkDataProc(cArr: any)
    {
        //依据下放的数据长度来更改原本数据的有效元素，保障运营期后台调整数据后能立即生效
        //数据比初始化时短，删掉冗余的ui节点和缓存数据，数据比初始化时长，就新增新的节点和缓存数据
        if(this.navDatArr_.length != cArr.length)
        {
            console.log('[RCShow _tmSdkDataProc] data length different')

            this.navDatArr_ = []
            this.navItemArr_ = []
            this.scrollArea_.removeChildren()
        }

        for(let i = 0; i < cArr.length; ++i)
        {
            let dat = null
            if(this.navItemArr_.length > 0)
            {
                dat = this.navDatArr_[i] || new HDNavData()
            }
            else
                dat = new HDNavData()

            if(cArr[i].show_config)
            {
                dat.img = cArr[i].show_config.image
                dat.name = cArr[i].show_config.title
            }

            dat.tmPosId = cArr[i].positionId
            dat.tmCid = cArr[i].creativeId

            //不存在数据才压入数组，否则应该是刷新数组
            if(!this.navDatArr_[i])
                this.navDatArr_.push(dat)
        }

        if(this.navItemArr_.length > 0)
        {
            for(let i = 0; i < this.navItemArr_.length; ++i)
            {
                let dat = this._getNextNavData()
                if(dat)
                {
                    this.navItemArr_[i].updateInfo(dat)
                }
            }
        }
        else
            this.buildSingles()
    }
    
    protected _getNextNavData()
    {
        let ret = null

        if(this.navDatArr_.length > 0)
        {
            ret = this.navDatArr_[this.navDatIdx_]

            ++this.navDatIdx_
            if(this.navDatIdx_ >= this.navDatArr_.length)
                this.navDatIdx_ = 0
        }

        return ret
    }

    protected _onScrolling()
    {
        
        if(this.updTimer_ > 0)
            this.bScroll_ = true
    }

    protected _onScrollEnd()
    {
 
        this.bScroll_ = false
        this.updTimer_ = 0
    }

    public setNameBgVisible(bVal = true)
    {
        this.bNameBg_ = bVal
    }
}

//横向展示栏
class HorShow extends RCShow {
    /**
     * 最大行数只允许1行，默认4列
     */
    init(navDatArr: HDNavData[], r = 1, c = 4, rp = 0, cp = 0, bName = false, bFrame = false, 
        updDura = 2, nameClr = '', navIdx = 0)
    {
        let row = r
        if(r > 1)
            row = 1

        this.origScl_ = bName ? this.hgt_ / kHorNHgt : this.hgt_ / kHorHgt
        this.helpScl_ = this.wid_ / kHorWid

        super.init(navDatArr, row, c, rp, cp, bName, bFrame, updDura, nameClr, navIdx)

        if(this.origScl_ >= 1 && !G.isEqualF(this.origScl_, this.helpScl_, 3))
        {
            let offset = kRCSide * (2 - this.helpScl_)
            // this.colPitch_ = cp - offset
            this.clipArea_.width = this.wid_ - (kRCSide + offset) * 2
        }
        else if(this.origScl_ < 1)
        {
            let offset = kRCSide * (1 - this.origScl_)
            // this.colPitch_ = cp - offset
            this.clipArea_.width = this.wid_ - (kRCSide + offset) * 2
            this.clipArea_.x += offset
        }

        let wid = this.bName_ ? kSNWid : kSWid
        this.moveDist_ = (wid + this.colPitch_) * this.origScl_
    }

    buildSingles()
    {
        if(this.navDatArr_.length > 0)
        {
            // super.buildSingles()

            for(let i = 0; i < this.navDatArr_.length; ++i)
            {
                this._createSingle(0, i, this.bName_, this.bFrame_)
            }

            this.scrollArea_.scrollPane.scrollLeft()
        }
    }

    update(dt)
    {
        if(this.com_.visible && this.navItemArr_.length > 0)
        {
            for(let i = 0; i < this.navItemArr_.length; ++i)
                this.navItemArr_[i].update(dt)

            if(this.bScroll_)
            {
                
            }
            else
            {
                this.updTimer_ += dt
                if(this.updTimer_ >= this.updDura_)
                {
                    this.bScroll_ = true
                    this.updTimer_ = 0

                    if(this.scrollArea_.scrollPane.percX == 1)
                    {
                        this.scrollArea_.scrollPane.scrollLeft(this.navItemArr_.length, true)
                    }
                    else
                    {
                        this.scrollArea_.scrollPane.scrollStep = this.moveDist_
                        this.scrollArea_.scrollPane.scrollRight(1, true)
                    }
                }
            }
        }
    }
}

//猜你喜欢
class GuessLikeShow extends HorShow {
    init(navDatArr: HDNavData[], r = 1, c = 4, rp = 0, cp = 0, bName = false, bFrame = false, 
        updDura = 2, nameClr = '', navIdx = 0)
    {
        super.init(navDatArr, r, c, rp, cp, bName, bFrame, updDura, nameClr, navIdx)

        this.moveDist_ = (kLNWid + this.colPitch_) * this.origScl_
    }

    protected _createSingle(r: number, c: number, bName = false, bFrame = false, iconScl = 1)
    {
        let dat = this._getNextNavData()
        if(dat)
        {
            let scl = this.origScl_ * iconScl

            let com = fgui.UIPackage.createObject('HDSDK', 'NavLikeEx').asCom
            let nav = new LikeNavEx(com)
            nav.init(dat, bFrame, this.nameClr_)
            nav.addToParent(this.clipArea_, (c * kLNWid + c * this.colPitch_) * scl, 
                (r * kLNHgt + r * this.rowPitch_) * scl, scl)
            nav.show()
            nav.registerTMSDKRefreshCallback(this._tmRefreshCallback.bind(this))

            if(nav)
                this.navItemArr_.push(nav)
        }
    }
}

//纵向展示栏
class VerShow extends RCShow {
    /**
     * 只能1列，默认4行
     */
    init(navDatArr: HDNavData[], r = 1, c = 4, rp = 0, cp = 0, bName = false, bFrame = false, 
        updDura = 2, nameClr = '', navIdx = 0)
    {
        let col = c
        if(c > 1)
            col = 1

        this.origScl_ = this.wid_ / kVerWid
        let vh = bName ? kVerNhgt : kVerHgt 
        this.helpScl_ = this.hgt_ / vh

        super.init(navDatArr, r, col, rp, cp, bName, bFrame, updDura, nameClr, navIdx)

        let bEqScl = G.isEqualF(this.origScl_, this.helpScl_, 3)
        if(this.origScl_ >= 1 && !bEqScl)
        {
            let offset = kRCSide * (2 - this.helpScl_)
            // this.rowPitch_ = rp - offset
            this.clipArea_.height = this.hgt_ - (kRCSide + offset) * 2
        }
        else if(this.origScl_ < 1)
        {
            let offset = kRCSide * ((!bEqScl ? 2 : 1) - this.origScl_)
            // this.rowPitch_ = rp - offset
            this.clipArea_.height = this.hgt_ - (kRCSide + offset) * 2
            this.clipArea_.y += offset
        }
    }

    buildSingles()
    {
        if(this.navDatArr_.length > 0)
        {
            // super.buildSingles()

            for(let i = 0; i < this.navDatArr_.length; ++i)
            {
                this._createSingle(i, 0, this.bName_, this.bFrame_)
            }

            let spd = 0
            if(this.bName_)
                spd = (kSNHgt + this.rowPitch_) * this.origScl_
            else
                spd = (kSHgt + this.rowPitch_) * this.origScl_

            this.scrollArea_.scrollPane.scrollStep = spd
            this.scrollArea_.scrollPane.scrollUp()
        }
    }

    update(dt)
    {
        if(this.com_.visible && this.navItemArr_.length > 0)
        {
            for(let i = 0; i < this.navItemArr_.length; ++i)
                this.navItemArr_[i].update(dt)

            if(this.bScroll_)
            {
                
            }
            else
            {
                
                this.updTimer_ += dt
                if(this.updTimer_ >= this.updDura_)
                {
                    this.bScroll_ = true
                    this.updTimer_ = 0

                    if(this.scrollArea_.scrollPane.percX == 1)
                    {
                        this.scrollArea_.scrollPane.scrollTop(true)
                    }
                    else
                    {
                        if(this.bName_)
                            this.moveDist_ = (kSNHgt + this.rowPitch_) * this.origScl_
                        else
                            this.moveDist_ = (kSHgt + this.rowPitch_) * this.origScl_

                        this.scrollArea_.scrollPane.scrollStep = this.moveDist_
                        this.scrollArea_.scrollPane.scrollDown(1, true)
                    }
                }
            }
        }
    }
}

const kVDWid = 300
const kVDHgt = 440
const kVDNHgt = 530
const kVDRatedR = 3

//纵向双排展示栏
class VerShowD extends RCShow {
    /**
     * 列数只允许2列，默认3行
     * updDura作为刷新信息的时间间隔
     */
    init(navDatArr: HDNavData[], r = 3, c = 2, rp = 0, cp = 0, bName = false, bFrame = false, 
        updDura = 5, nameClr = '', navIdx = 0)
    {
        let col = c
        if(c > 2 || c < 2)
            col = 2

        let sw = this.wid_ / kVDWid
        let sh = this.hgt_ / (bName ? kVDNHgt : kVDHgt)

        this.origScl_ = Math.min(sw, sh)

        super.init(navDatArr, r, col, rp, cp, bName, bFrame, updDura, nameClr, navIdx)
    }

    buildSingles()
    {
        if(this.navDatArr_.length > 0)
        {
            let r = 0
            let c = 0
            for(let i = 0; i < this.navDatArr_.length; ++i)
            {
                this._createSingle(r, c, this.bName_, this.bFrame_)

                ++c
                if(c >= this.col_)
                {
                    ++r
                    c = 0
                }
            }
        }
    }
}

const kGridTitleHgt = 60

class GridShow extends RCShow {
    protected titleImg_: FGUIImage = null
    protected bg_: FGUIImage = null;

    constructor(com: FGUICom)
    {
        super(com)

        this.titleImg_ = com.getChild('titleImg').asImage
        this.bg_ = com.getChild('bg').asImage
    }

    init(navDatArr: HDNavData[], r = 2, c = 4, rp = 0, cp = 0, bName = false, bFrame = false, 
        updDura = 5, nameClr = '', navIdx = 0, bBg = true)
    {
        super.init(navDatArr, r, c, rp, cp, bName, bFrame, updDura, nameClr, navIdx)
        let hgt = bName ? kSNHgt : kSHgt
        this.hgt_ = (hgt * r + kRCSide * 2 + rp * (r - 1) + kGridTitleHgt) * this.origScl_

        if (this.bg_) 
            this.bg_.visible = bBg
    }

    show(log = '', bUpload = false)
    {
        super.show(log, bUpload)
        this.clipArea_.scrollPane.scrollTop(true);
        this._randomInfo()
    }

    showTM(posId: string)
    {
        console.log('[GridShow showTM]')

        super.showTM(posId)
        this.clipArea_.scrollPane.scrollTop(true)
    }

    showTitle()
    {
        if(this.titleImg_)
            this.titleImg_.visible = true
    }

    hideTitle()
    {
        if(this.titleImg_)
            this.titleImg_.visible = false
    }
    // update(dt)
    // {

    //     if (!this.bScroll_) {
    //          this.updTimer_ += dt
    //         if(this.updTimer_ >= this.updDura_)
    //         {
    //             this.bScroll_ = true
    //             this.updTimer_ = 0

                
    //             if(this.clipArea_.scrollPane.percY == 1)
    //             {
    //                 this.clipArea_.scrollPane.scrollTop(true)
    //             }
    //             else
    //             {
    //                 this.clipArea_.scrollPane.scrollStep = (kSNHgt + kVPRowPitch) * kVPMidScale
    //                 this.clipArea_.scrollPane.scrollDown(1, true)
    //             }
    //         }
    //     }
       
    // }

    buildSingles()
    {
        if(this.navDatArr_.length > 0)
        {
            //通过裁剪区域高度与额定高度的对比，测试出缩放后行距应该有多少变化，如果行距本身为负，行距变化变小
            let hgt = this.bName_ ? kSNHgt : kSHgt
            let gap = this.clipArea_.height - (hgt * this.row_) * this.origScl_
            
            if(this.rowPitch_ < 0)
            {
                let gs = gap * this.origScl_ / this.row_
                
                this.rowPitch_ += gs
            }
            else
            {
                let r = (this.row_ - 1)
                if(r <= 0)
                    r = 1
                this.rowPitch_ += gap * this.origScl_ / r
            }

            let r = 0
            let c = 0
            for(let i = 0; i < this.navDatArr_.length; ++i)
            {
                this._createSingle(r, c, this.bName_, this.bFrame_)

                ++c
                if(c >= this.col_)
                {
                    ++r
                    c = 0
                }
            }
        }
    }
}

const kG24Wid = 580
const kG24Hgt = 360
const kG24NHgt = 430

//网格展示栏
class GridShow2x4 extends GridShow {
    /**
     * 固定2行4列
     * updDura作为刷新信息的时间间隔
     */
    init(navDatArr: HDNavData[], r = 2, c = 4, rp = 0, cp = 0, bName = false, bFrame = false, 
        updDura = 5, nameClr = '', navIdx = 0)
    {
        let col = c
        if(c !== 4)
            col = 4

        let row = r
        if(r !== 2)
            row = 2

        let sw = this.wid_ / kG24Wid
        let sh = this.hgt_ / (bName ? kG24NHgt : kG24Hgt)

        this.origScl_ = Math.min(sw, sh)

        super.init(navDatArr, row, col, rp, cp, bName, bFrame, updDura, nameClr, navIdx)
    }
}

const kG23Wid = 475
const kG23Hgt = 360
const kG23NHgt = 440

//网格展示栏
class GridShow2x3 extends GridShow {
    /**
     * 固定2行3列
     * updDura作为刷新信息的时间间隔
     */
    init(navDatArr: HDNavData[], r = 2, c = 3, rp = 0, cp = 0, bName = false, bFrame = false, 
        updDura = 5, nameClr = '', navIdx = 0, bBg = true)
    {
        let col = c
        if(c !== 3)
            col = 3

        let row = r
        if(r !== 2)
            row = 2

        let sw = this.wid_ / kG23Wid
        let sh = this.hgt_ / (bName ? kG23NHgt : kG23Hgt)

        this.origScl_ = Math.min(sw, sh)

        super.init(navDatArr, row, col, rp, cp, bName, bFrame, updDura, nameClr, navIdx, bBg)
    }
}

const kG33Wid = 440
const kG33Hgt = 500
const kG33NHgt = 600

class GridShow3x3 extends GridShow {
    /**
     * 固定3行3列
     * updDura作为刷新信息的时间间隔
     */
    init(navDatArr: HDNavData[], r = 3, c = 3, rp = 0, cp = 0, bName = false, bFrame = false, 
        updDura = 5, nameClr = '', navIdx = 0)
    {
        let col = c
        if(c !== 3)
            col = 3

        let row = r
        if(r !== 3)
            row = 3

        let sw = this.wid_ / kG33Wid
        let sh = this.hgt_ / (bName ? kG33NHgt : kG33Hgt)

        this.origScl_ = Math.min(sw, sh)

        super.init(navDatArr, row, col, rp, cp, bName, bFrame, updDura, nameClr, navIdx)
    }
}

class Pop3x3 extends GridShow3x3 {
    private block_: FGUICom = null

    constructor(com: FGUICom)
    {
        super(com)

        if(com)
        {
            this.block_ = com.getChild('block').asCom
            this.block_.setSize(cc.view.getVisibleSize().width, cc.view.getVisibleSize().height)
            let c = ExportUI.instance.getCenterXY()
            let g = this.block_.localToGlobal()
            let offsetX = c.x - g.x
            let offsetY = c.y - g.y
            let ox = this.block_.x
            let oy = this.block_.y
            this.block_.setPosition(ox + offsetX, oy + offsetY)

            this.block_.onClick(this._onClick, this)
        }
    }

    show(log = '', bUpload = false)
    {
        super.show(log, bUpload)

        this.block_.visible = true

        // this._randomInfo()
    }

    private _onClick()
    {
        this.block_.visible = false
        this.hide()
    }
}

const kG34Wid = 450
const kG34Hgt = 640
const kG34NHgt = 815

class GridShow4x3 extends GridShow {
    /**
     * 固定4行3列
     * updDura作为刷新信息的时间间隔
     */
    init(navDatArr: HDNavData[], r = 4, c = 3, rp = 0, cp = 0, bName = false, bFrame = false, 
        updDura = 5, nameClr = '', navIdx = 0)
    {
      
        let col = c
        if(c !== 3)
            col = 3

        let row = r
        if(r !== 4)
            row = 4

        let sw = this.wid_ / kG34Wid
        let sh = this.hgt_ / (bName ? kG34NHgt : kG34Hgt)
        
        //this.origScl_ = Math.min(sw, sh)
        this.origScl_ = 1.05;
        super.init(navDatArr, row, col, rp, cp, bName, bFrame, updDura, nameClr, navIdx)
    }
}

class Pop4x3 extends GridShow4x3 {
    private block_: FGUICom = null

    constructor(com: FGUICom)
    {
        super(com)

        if(com)
        {
            this.block_ = com.getChild('block').asCom
            this.block_.setSize(cc.view.getVisibleSize().width, cc.view.getVisibleSize().height)
            let c = ExportUI.instance.getCenterXY()
            let g = this.block_.localToGlobal()
            let offsetX = c.x - g.x
            let offsetY = c.y - g.y
            let ox = this.block_.x
            let oy = this.block_.y
            this.block_.setPosition(ox + offsetX, oy + offsetY)

            this.block_.onClick(this._onClick, this)
        }
    }

    show(log = '', bUpload = false)
    {
        super.show(log, bUpload)

        this.block_.visible = true

        // this._randomInfo()
    }

    private _onClick()
    {
        this.block_.visible = false
        this.hide()
    }
}

const kFWid = 570
const kFHgt = 440
const kFNHgt = 540
const kFBtnWid = 130
const kFBtnHgt = 60
const kFBtnOffsetX = 2
const kFBtnOffsetY = 10

//抽屉页
class FoldPageShow extends RCShow {
    private foldBtn_: FGUIButton
    private btnTrans_: FGUITrans
    private btnCtrl_: FGUICtrl

    private unfoldCallback_: Function = null
    private foldCallback_: Function = null

    private iconScl_ = 1

    private btnOrigY_ = 0

    private btnDistY_ = 0
    private btnDestY_ = 0

    private foldState_ = 0 //0 folded 1 unfolding 2 unfolded 3 folding
    private bUnfolded_ = false

    private bMirrow_ = false

    private bAuto_ = false
    private autoFoldTimer_ = 0

    constructor(com: FGUICom)
    {
        super(com)

        if(com)
        {
            this.foldBtn_ = com.getChild('foldBtn').asButton
            this.btnTrans_ = this.foldBtn_.getTransition('spring')
            this.btnCtrl_ = this.foldBtn_.getController('arrow')

            this.btnOrigY_ = this.foldBtn_.y

            this.foldBtn_.onClick(this._onClick, this)
        }
    }

    init(navDatArr: HDNavData[], r = 3, c = 3, rp = 0, cp = 0, bName = false, bFrame = false, 
        updDura = 5, nameClr = '', navIdx = 0, iconScl = 1, bMirror = false)
    {
        let col = c
        if(c < 2)
            col = 2
        else if(c > 3)
            col = 3

        let sw = this.wid_ / kFWid
        let sh = this.hgt_ / (bName ? kFNHgt : kFHgt)

        this.iconScl_ = iconScl

        if(this.iconScl_ == 1)
            this.origScl_ = Math.min(sw, sh)
        else
            this.origScl_ = 1

        super.init(navDatArr, r, col, rp, cp, bName, bFrame, updDura, nameClr, navIdx)

        this.bMirrow_ = bMirror
    }

    appendExtraFunc(navSucCb?: Function, navFailCb?: Function, tt = ExportTransType.kNone, transDura = 5, 
        foldCb: Function = null, unfoldCb: Function = null)
    {
        for(let i = 0; i < this.navItemArr_.length; ++i)
        {
            this.navItemArr_[i].appendExtraFunc(navSucCb, navFailCb, tt, -1,  G.randRange(1,5))
        }

        this.foldCallback_ = foldCb
        this.unfoldCallback_ = unfoldCb
    }

    show(log = '', bUpload = false)
    {
        super.show(log, bUpload)
     
        this.btnTrans_.play(null, -1)
      
    }

    showTM(posId: string)
    {
        super.showTM(posId)

        this.btnTrans_.play(null, -1)
    }

    hide()
    {
        super.hide()
       
        this.btnTrans_.stop()
      
    }

    autoUnfold()
    {
        this._onClick()
        
        this.bAuto_ = true
        this.autoFoldTimer_ = 0
    }

    fold()
    {
        if (this.foldState_ == 2) 
        {
            this._onClick()
        }
    }

    update(dt)
    {
        if(this.com_.visible)
        {
            if(this.foldState_ == 1) //unfolding
            {
                this.moveDist_ = this.moveDist_ / 2
            
                if(this.bMirrow_)
                    this.com_.x -= this.moveDist_
                else 
                    this.com_.x += this.moveDist_

                if(Math.abs(this.moveDist_) <= 5)
                {
                    this.foldState_ = 2

                    if(this.bMirrow_)
                        this.com_.x = this.com_.parent.width - this.com_.width
                    else
                        this.com_.x = 0

                    this.btnCtrl_.selectedIndex = 1
                    this.btnTrans_.stop()

                    ExportUI.instance.block(true, this._onClick.bind(this))

                    if(this.unfoldCallback_)
                        this.unfoldCallback_()
                }
            }
            else if(this.foldState_ == 2) //unfolded
            {
                if(this.bAuto_)
                {
                    this.autoFoldTimer_ += dt
                    if(this.autoFoldTimer_ >= 5)
                    {
                        this.bAuto_ = false
                        //this._onClick()
                    }
                }

                if(this.navItemArr_.length > 0)
                {
                    for(let i = 0; i < this.navItemArr_.length; ++i)
                        this.navItemArr_[i].update(dt)

                    if(!this.bScroll_)
                    {
                        this.updTimer_ += dt
                        if(this.updTimer_ >= this.updDura_)
                        {
                            this.bScroll_ = true
                            this.updTimer_ = 0

                            if(this.clipArea_.scrollPane.percY == 1)
                            {
                                this.clipArea_.scrollPane.scrollTop(true)
                            }
                            else
                            {
                                if(this.bName_)
                                    this.moveDist_ = (kSNHgt + this.rowPitch_) * this.origScl_
                                else
                                    this.moveDist_ = (kSHgt + this.rowPitch_) * this.origScl_

                                this.clipArea_.scrollPane.scrollStep = this.moveDist_
                                this.clipArea_.scrollPane.scrollDown(1, true)
                            }
                        }
                    }
                }
            }
            else if(this.foldState_ == 3) //folding
            {
                this.moveDist_ = this.moveDist_ / 2
            
                if(this.bMirrow_)
                    this.com_.x += this.moveDist_
                else 
                    this.com_.x -= this.moveDist_

                if(Math.abs(this.moveDist_) <= 5)
                {
                    this.foldState_ = 0

                    if(this.bMirrow_)
                        this.com_.x = this.com_.parent.width - this.foldBtn_.width
                    else
                        this.com_.x = -this.com_.width + this.foldBtn_.width

                    this.btnCtrl_.selectedIndex = 0
                    this.btnTrans_.play(null, -1)

                    ExportUI.instance.unblock()

                    if(this.foldCallback_)
                        this.foldCallback_()
                }
            }

            //move fold btn to 10px from top of parent
            if(this.btnDistY_ != 0)
            {
                this.btnDistY_ = this.btnDistY_ / 2

                this.foldBtn_.y += this.btnDistY_
                if(Math.abs(this.foldBtn_.y - this.btnDestY_) <= 2)
                {
                    this.foldBtn_.y = this.btnDestY_

                    this.btnDistY_ = 0
                }
            }
        }
    }

    buildSingles()
    {
        if(this.navDatArr_.length > 0)
        {
            //通过裁剪区域高度与额定高度的对比，测试出缩放后行距应该有多少变化，如果行距本身为负，行距变化变小
            let hgt = this.bName_ ? kSNHgt : kSHgt
            let gap = this.clipArea_.height - (hgt * this.row_) * this.origScl_
            
            if(this.rowPitch_ < 0)
            {
                let gs = gap * this.origScl_ / this.row_
                
                this.rowPitch_ += gs
            }
            else
            {
                let r = (this.row_ - 1)
                if(r <= 0)
                    r = 1
                this.rowPitch_ += gap * this.origScl_ / r
            }

            let r = 0
            let c = 0
            for(let i = 0; i < this.navDatArr_.length; ++i)
            {
                this._createSingle(r, c, this.bName_, this.bFrame_, this.iconScl_)

                ++c
                if(c >= this.col_)
                {
                    ++r
                    c = 0
                }
            }
        }
    }

    private _onClick()
    {
        if(this.foldState_ === 0 || this.foldState_ === 2)
        {
            if(!this.bUnfolded_)
            {
                if(!G.isTMSDK)
                    this._randomInfo()

                this.foldState_ = 1

                this.moveDist_ = this.com_.width - kFBtnWid
                this.btnDistY_ = kFBtnOffsetY - this.btnOrigY_
                this.btnDestY_ = kFBtnOffsetY

                this.bUnfolded_ = true

                if(this.bAuto_)
                {
                    this.bAuto_ = false
                    this.autoFoldTimer_ = 0
                }
            }
            else
            {
                this.foldState_ = 3

                this.moveDist_ = this.com_.width - kFBtnWid
                this.btnDistY_ = this.btnOrigY_ - this.foldBtn_.y
                this.btnDestY_ = this.btnOrigY_

                this.bUnfolded_ = false

                if(this.bAuto_)
                {
                    this.bAuto_ = false
                    this.autoFoldTimer_ = 0
                }
            }
        }
    }
}

const kVPCol = 3 //中部展示栏的列数和行数
const kVPRow = 3

const kVPRowPitch = 10 //中部展示栏的行间距和列间距
const kVPColPitch = 12

const kVPTopUpdDura = 2 //顶部横向展示栏的滚动时间间隔
const kVPMidUpdDura = 1 //中部展示栏的滚动时间间隔

const kVPTopScale = 0.86 //顶部展示栏icon的缩放比例
const kVPMidScale = 1.37//中部展示栏的icon缩放比例

const kVPMissingClick = true //是否激活滑动误点
const kVPBnrMissClick = true //是否开启banner误点

//竖屏独立页面
class VPageShow {
    protected com_: FGUICom = null

    protected topScroll_: FGUICom = null
    protected midScroll_: FGUICom = null

    protected blockCom_: FGUICom = null

    protected closeBtn_: FGUIButton = null
    protected continueGameBtn_:FGUIButton=null;

    protected showTrans_: FGUITrans = null

    protected navDatArr_: HDNavData[] = []
    protected topNavIdx_ = 0 //顶部展示区跳转数据索引
    protected midNavIdx_ = 0

    protected topNavItems_: SingleNav[] = []
    protected midNavItems_: SingleNav[] = []

    //----中间部分单个展示的显示动效专用-----
    protected showTransIdx_ = 0 //单个展示播放动效的索引，midNavItems使用
    protected transRandIdxArr_ = []
    protected showTimer_ = 0
    protected stepTimer_ = 0
    protected bShowItems_ = false
    protected midGrids_ = 0

    protected colPitch_ = 0

    protected bName_ = false
    protected nameClr_ = ''

    protected updTopTimer_ = 0 //计时器
    protected updMidTimer_ = 0 //计时器

    protected bTopScroll_ = false
    protected bMidScroll_ = false

    protected bMidDown_ = true

    protected missDownX_ = -1
    protected missDownY_ = -1
    protected bMissingClick_ = false

    protected bInited_ = false
    protected bClicked_ = false //是否已经点过按钮

    protected bBnrJumping_ = false
    protected bBnrJump_ = false

    protected bExportMissClick_ = false
    protected bBnrMissClick_ = false

    protected midMoveSpd_ = 0

    constructor(bSkip = false)
    {
        if(bSkip)
            return

        this.bExportMissClick_ = kVPMissingClick
        this.bBnrMissClick_ = kVPBnrMissClick

        let c = fgui.UIPackage.createObject('HDSDK', 'VerPage')
        if(c)
        {
            this.com_ = c.asCom
            this.com_.visible = false
            c.sortingOrder = UIHierarchy.kExportPage

            let ts = this.com_.getChild('top').asCom
            if(ts)
            {
                this.topScroll_ = ts.getChild('list').asCom
                this.topScroll_.on(fgui.Event.SCROLL, this._onTopScrolling, this)
                this.topScroll_.on(fgui.Event.SCROLL_END, this._onTopScrollEnd, this)
            }
            
            let ms = this.com_.getChild('scroll')
            if(ms)
            {
                this.midScroll_ = ms.asCom
                this.midScroll_.on(fgui.Event.SCROLL, this._onMidScrolling, this)
                this.midScroll_.on(fgui.Event.SCROLL_END, this._onMidScrollEnd, this)
            }

            //注册了Event.SCROLL后会派发一次，导致onScrolling在update更新一次之后会执行到，bScroll_被设置为true，无法自动滚动
            //此处设置一个定时器恢复bScroll_状态
            TimedTaskInst.add(()=>{ 
                this.bTopScroll_ = false 
                this.bMidScroll_ = false
            }, 0.5)

            this.blockCom_ = this.com_.getChild('block').asCom
            let bg = this.blockCom_.getChild('bg')
            if(bg)
                bg.visible = false

            this.closeBtn_ = this.com_.getChild('closeBtn').asButton
            this.continueGameBtn_=this.com_.getChild("continueGameBtn").asButton

            this.closeBtn_.onClick(this._onClose, this)
            this.continueGameBtn_.onClick(this._onContinue, this)

            this.showTrans_ = this.com_.getTransition('show')
        }
    }

    init(navDatArr: HDNavData[], parent: FGUICom, bName = false, nameClr = '')
    {
        if(this.com_ && !this.bInited_)
        {
            this.com_.setSize(parent.width, parent.height)
            parent.addChild(this.com_)

            this.navDatArr_ = navDatArr

            this.bName_ = bName
            this.nameClr_ = nameClr

            if(G.isTMSDK)
            {

            }
            else
            {
                this._initIcons()
            }

            this.hide()

            this.bInited_ = true
        }
    }

    /**
     * 添加附加的一些功能参数，比如点击跳转后失败处理回调
     * @param navSucCb 跳转成功回调
     * @param navFailCb 跳转失败（取消）回调
     * @param tt 动效播放种类，默认无
     * @param tranDura 多久播放一次动效，默认5s
     */
    appendExtraFunc(navSucCb?: Function, navFailCb?: Function, tt = ExportTransType.kNone, transDura = 5)
    {
        for(let i = 0; i < this.topNavItems_.length; ++i)
        {
            this.topNavItems_[i].appendExtraFunc(navSucCb, navFailCb, tt, -1, transDura)
        }

        for(let i = 0; i < this.midNavItems_.length; ++i)
        {
            this.midNavItems_[i].appendExtraFunc(navSucCb, navFailCb, tt, -1, transDura)
        }
    }
    
    update(dt)
    {
        if(this.com_.visible)
        {
            if(this.bShowItems_)
            {
                this.showTimer_ += dt
                this.stepTimer_ += dt
                
                if(this.stepTimer_ >= 0.03 && this.showTransIdx_ < this.midNavItems_.length)
                {
                    if(this.transRandIdxArr_[this.showTransIdx_] != null)
                    {
                        let idx = this.transRandIdxArr_[this.showTransIdx_]
                        if(this.midNavItems_[idx])
                            this.midNavItems_[idx].playTrans(ExportTransType.kFade)
                    }

                    this.stepTimer_ -= 0.03
                    ++this.showTransIdx_
                }

                if(this.showTimer_ >= 0.5)
                {
                    for(let i = 0; i < this.midNavItems_.length; ++i)
                    {
                        if(i < this.midGrids_)
                            this.midNavItems_[i].alpha = 1
                    }

                    this.bShowItems_ = false
                    this.showTimer_ = 0
                }
            }
            else
            {
                for(let i = 0; i < this.topNavItems_.length; ++i)
                    this.topNavItems_[i].update(dt)

                for(let i = 0; i < this.midNavItems_.length; ++i)
                    this.midNavItems_[i].update(dt)

                if(!this.bTopScroll_)
                {
                    this.updTopTimer_ += dt
                    if(this.updTopTimer_ >= kVPTopUpdDura)
                    {
                        this.bTopScroll_ = true
                        this.updTopTimer_ = 0

                        if(this.topScroll_.scrollPane.percX == 1)
                        {
                            this.topScroll_.scrollPane.scrollLeft(this.topNavItems_.length, true)
                        }
                        else
                        {
                            this.topScroll_.scrollPane.scrollStep = kSWid * kVPTopScale + kVPColPitch
                            this.topScroll_.scrollPane.scrollRight(1, true)
                        }
                    }
                }

                if(!this.bMidScroll_ && !this.bClicked_)
                {
                    this.updMidTimer_ += dt
                    if(this.updMidTimer_ >= kVPMidUpdDura)
                    {
                        //this.bMidScroll_ = true
                        
                        if(this.midScroll_.scrollPane.percY == 1)
                        {
                            this.midMoveSpd_ = 0
                            this.midScroll_.scrollPane.scrollTop(true)

                            this.updMidTimer_ = 0
                        
                        }
                        else
                        {
                            // this.midScroll_.scrollPane.scrollStep =(kSNHgt + kVPRowPitch) * kVPMidScale
                            // this.midScroll_.scrollPane.scrollDown(1, false)
                            this.midMoveSpd_ += 2;
                            this.midScroll_.scrollPane.setPosY(this.midMoveSpd_, true)
                        }
                    }
                }
            }
        }
    }

    show(log = '')
    {
        if(this.com_ && !this.com_.visible)
        {
            this.midMoveSpd_ = 0
            this.bClicked_ = false

            this.com_.visible = true

            if(this.bExportMissClick_)
            {
	            this.com_.node.on(cc.Node.EventType.TOUCH_START, this._onDown, this)
                this.com_.node.on(cc.Node.EventType.TOUCH_MOVE, this._onMove, this)
                this.com_.node.on(cc.Node.EventType.TOUCH_END, this._onUp, this)
            }

            if(this.closeBtn_)
                this.closeBtn_.visible = !this.bBnrJump_

            this.transRandIdxArr_.sort((a, b)=>{ return Math.random() > 0.5 ? -1 : 1 })

            for(let i = 0; i < this.topNavItems_.length; ++i)
                this.topNavItems_[i].show(log, false)

            this.midNavIdx_ = G.randRange(0, this.midNavItems_.length - 1)
            for(let i = 0; i < this.midNavItems_.length; ++i)
            {
                if(i < this.midGrids_)
                    this.midNavItems_[i].alpha = 0

                this.midNavItems_[i].show(log, false)

                if(!G.isTMSDK)
                {
                    let dat = this._getNextMidNavData()
                    if(dat)
                        this.midNavItems_[i].updateInfo(dat)
                }
            }

            this.midScroll_.scrollPane.scrollTop(false)

            this.blockCom_.visible = true
           
            if(this.showTrans_)
                this.showTrans_.play(this._onShowOver.bind(this), 1, 0, 2)
            else
                this._onShowOver()
          
            this.showTimer_ = 0
            this.showTransIdx_ = 0
            this.bShowItems_ = true

            ExportUI.instance.uploadLog(log, '展示')
        }
    }

    showTM(posId: string)
    {
        wx.tmSDK.getFlowConfig({
            positionId: posId
        }).then((config) => {
            if(config.isOpen)
            {
                console.log('[VPageShow showTM] download data')

                let cArr = config.creatives
                if(cArr)
                {
                    this._tmSdkDataProc(cArr)

                    this.show()
                }
            }
        })
    }

    hide()
    {
        if(this.com_)
        {
            this.com_.visible = false

            if(this.bExportMissClick_)
            {
	            this.com_.node.off(cc.Node.EventType.TOUCH_START, this._onDown, this)
                this.com_.node.off(cc.Node.EventType.TOUCH_MOVE, this._onMove, this)
                this.com_.node.off(cc.Node.EventType.TOUCH_END, this._onUp, this)
            }
        }

        if(this.showTrans_)
            this.showTrans_.stop()
    }

    protected _initIcons()
    {
        for(let i = 0; i < this.navDatArr_.length; ++i)
        {
            this._createTopSingle(0, i, this.topScroll_)
        }
        this.topScroll_.scrollPane.scrollLeft()

        //mid fill
        this.colPitch_ = (this.midScroll_.width - kVPCol * kSNWid * kVPMidScale) / (kVPCol - 1)

        this.midGrids_ = kVPCol * kVPRow
        let midCnt = this.navDatArr_.length > this.midGrids_ ? this.navDatArr_.length : this.midGrids_
        let r = 0
        let c = 0
        for(let i = 0; i < midCnt; ++i)
        {
            this._createMidSingle(r, c, this.midScroll_)

            if(i < this.midGrids_)
            {
                this.transRandIdxArr_[i] = i
            }

            ++c
            if(c >= kVPCol)
            {
                ++r
                c = 0
            }
        }
    }

    protected _tmSdkDataProc(cArr: any)
    {
        if(this.navDatArr_.length != cArr.length)
        {
            console.log('[RCShow _tmSdkDataProc] data length different')

            this.navDatArr_ = []
            this.topNavItems_ = []
            this.midNavItems_ = []
            this.topScroll_.removeChildren()
            this.midScroll_.removeChildren()
        }

        for(let i = 0; i < cArr.length; ++i)
        {
            let dat = null
            if(this.topNavItems_.length > 0)
            {
                dat = this.navDatArr_[i] || new HDNavData()
            }
            else
                dat = new HDNavData()

            if(cArr[i].show_config)
            {
                dat.img = cArr[i].show_config.image
                dat.name = cArr[i].show_config.title
            }

            dat.tmPosId = cArr[i].positionId
            dat.tmCid = cArr[i].creativeId

            //不存在数据才压入数组，否则应该是刷新数组
            if(!this.navDatArr_[i])
                this.navDatArr_.push(dat)
        }

        if(this.topNavItems_.length > 0 || this.midNavItems_.length > 0)
        {
            for(let i = 0; i < this.topNavItems_.length; ++i)
            {
                let dat = this._getNextTopNavData()
                if(dat)
                {
                    this.topNavItems_[i].updateInfo(dat)
                }
            }

            for(let i = 0; i < this.midNavItems_.length; ++i)
            {
                let dat = this._getNextMidNavData()
                if(dat)
                {
                    this.midNavItems_[i].updateInfo(dat)
                }
            }
        }
        else
        {
            this._initIcons()
        }
    }

    protected _tmRefreshCallback(creatives: any, posId: string)
    {
        let cArr = creatives
        if(cArr)
        {
            console.log('[VPageShow _tmRefreshCallback]')

            this._tmSdkDataProc(cArr)
        }
    }

    protected _onTopScrolling()
    {
        if(this.updTopTimer_ > 0)
            this.bTopScroll_ = true
    }

    protected _onTopScrollEnd()
    {
        this.bTopScroll_ = false
        this.updTopTimer_ = 0
    }

    protected _onMidScrolling()
    {
        // if(this.updMidTimer_ > 0)
        //     this.bMidScroll_ = true
    }

    protected _onMidScrollEnd()
    {
        // this.bMidScroll_ = false
        // this.updMidTimer_ = 0
    }

    protected _onShowOver()
    {
        this.blockCom_.visible = false
    }

    protected _onClose()
    {
        ExportUI.instance.hidePage()
    }

    protected _onContinue()
    {
        if(this.bBnrMissClick_)
        {
            if(this.bBnrJump_ && ExportUIInst.getPageBannerID() != '')
            {
                if(this.bBnrJumping_)
                {
                    
                }
                else
                    ExportUIInst.hidePage()
            }
            else
                ExportUIInst.hidePage()
        }
        else
            ExportUI.instance.hidePage()
    }

    protected _onDown(evt: cc.Event.EventTouch)
    {
        this.missDownX_ = evt.getLocationX()
        this.missDownY_ = evt.getLocationY()

        this.bMissingClick_ = false

        this.bClicked_ = true
    }

    protected _onMove(evt: cc.Event.EventTouch)
    {
        if(this.missDownX_ == -1 || this.missDownY_ == -1)
            return

        let offsetX = Math.abs(evt.getLocationX() - this.missDownX_)
        let offsetY = Math.abs(evt.getLocationY()- this.missDownY_)
        if((offsetX > 10 || offsetY > 10) && !this.bMissingClick_)
        {
            if(G.randRange(0, 100) <= DataHub.config.fakeBtnClick)
            {
                let mx = evt.getLocationX(),
                    my = evt.getLocationY()

                let tx = this.topScroll_.localToGlobal().x,
                    ty = this.topScroll_.localToGlobal().y,
                    tw = this.topScroll_.width,
                    th = this.topScroll_.height

                let lx = this.midScroll_.localToGlobal().x,
                    ly = this.midScroll_.localToGlobal().y,
                    lw = this.midScroll_.width,
                    lh = this.midScroll_.height

                //顶部区域
                if(my < ly && my > ty)
                {
                    let idx = this.topScroll_.getFirstChildInView()

                    if(mx < tx)
                        mx = tx
                    else if(mx > tx + tw)
                        mx = tx + tw

                    if(my < ty)
                        my = ty
                    else if(my > ty + th)
                        my = ty + th

                    let divX = tw / 4
                    let ix = Math.floor((mx - tx) / divX)

                    let nav = this.topNavItems_[idx + ix]
                    if(nav)
                        nav.clickTrigger()
                }
                else if(my > ly && my < ly + lh) //中部区域
                {
                    let idx = this.midScroll_.getFirstChildInView()

                    if(mx < lx)
                        mx = lx
                    else if(mx > lx + lw)
                        mx = lx + lw

                    if(my < ly)
                        my = ly
                    else if(my > ly + lh)
                        my = ly + lh

                    let divX = lw / 3
                    let divY = lh / 3
                    let ix = Math.floor((mx - lx) / divX)
                    let iy = Math.floor((my - ly) / divY)

                    let nav = this.midNavItems_[idx + ix + iy * 3]
                    if(nav)
                    {
                        nav.clickTrigger()
                    }
                }
            }

            this.bMissingClick_ = true
        }
    }

    protected _onUp()
    {
        this.bMissingClick_ = true

        this.missDownX_ = -1
        this.missDownY_ = -1
    }

    protected _createTopSingle(r: number, c: number, parent: FGUICom)
    {
        let dat = this._getNextTopNavData()
        if(dat)
        {
            let scl = kVPTopScale

            let nav: SingleNav = null
            if(this.bName_)
            {
                let com = fgui.UIPackage.createObject('HDSDK', 'NavItemEx').asCom
                nav = new SingleNavEx(com)
                nav.init(dat, true, this.nameClr_)
                nav.setCancelJumpActive(false)
                nav.addToParent(parent, (c * kSNWid) * scl  + c * kVPColPitch, 0, scl)
                nav.show()
                nav.registerTMSDKRefreshCallback(this._tmRefreshCallback.bind(this))
            }
            else
            {
                let com = fgui.UIPackage.createObject('HDSDK', 'NavItem').asCom
                nav = new SingleNav(com)
                nav.init(dat, true)
                nav.setCancelJumpActive(false)
                nav.addToParent(parent, (c * kSWid) * scl  + c * kVPColPitch, 0, scl)
                nav.show()
                nav.registerTMSDKRefreshCallback(this._tmRefreshCallback.bind(this))
            }

            if(nav)
                this.topNavItems_.push(nav)
        }
    }

    protected _createMidSingle(r: number, c: number, parent: FGUICom)
    {
        let dat = this._getNextMidNavData()
        if(dat)
        {
            let com = fgui.UIPackage.createObject('HDSDK', 'NavItemEx').asCom
            let nav = new SingleNavEx(com)
            nav.init(dat, true)
            nav.setCancelJumpActive(false)
            //注意带名字的宽高不同
            nav.addToParent(parent, c * kSNWid * kVPMidScale + c * this.colPitch_, 
                (r * kSNHgt + r * kVPRowPitch) * kVPMidScale, kVPMidScale)
            nav.appendExtraFunc(null, null, dat.tag === 1 ? ExportTransType.kSpring : ExportTransType.kNone)
            nav.show()
            nav.registerTMSDKRefreshCallback(this._tmRefreshCallback.bind(this))
            
            this.midNavItems_.push(nav)
        }
    }
    
    protected _getNextTopNavData()
    {
        let ret = null

        if(this.navDatArr_.length > 0)
        {
            ret = this.navDatArr_[this.topNavIdx_]

            ++this.topNavIdx_
            if(this.topNavIdx_ >= this.navDatArr_.length)
                this.topNavIdx_ = 0
        }

        return ret
    }

    protected _getNextMidNavData()
    {
        let ret = null

        if(this.navDatArr_.length > 0)
        {
            ret = this.navDatArr_[this.midNavIdx_]

            ++this.midNavIdx_
            if(this.midNavIdx_ >= this.navDatArr_.length)
                this.midNavIdx_ = 0
        }

        return ret
    }
}

const kHPCol = 5
const kHPRow = 3
const kHPBnrC = 2
const kHPBnrR = 2

const kHPRowPitch = 20 //中部展示栏的行间距和列间距
const kHPColPitch = 20
const kHPTopCP = 40

const kHPBnrCP = 60

const kHPMidScale = 1

const kHPTopUpdDura = 2 //顶部横向展示栏的滚动时间间隔
const kHPMidUpdDura = 2 //中部展示栏的滚动时间间隔

//横屏独立页面（抽屉）
class HPageShow {
    private com_: FGUICom = null

    private topScroll_: FGUICom = null
    private midScroll_: FGUICom = null
    private bnrScroll_: FGUICom = null

    private blockCom_: FGUICom = null

    private closeBtn_: FGUIButton = null
    private prevBtn_: FGUIButton = null
    private nextBtn_: FGUIButton = null

    private tabGrp_: FGUIGroup = null

    private tabCtrl_: FGUICtrl = null

    private navDatArr_: HDNavData[] = []
    private bnrDatArr_: HDNavData[] = []
    private topNavIdx_ = 0 //顶部展示区跳转数据索引
    private midNavIdx_ = 0
    private bnrNavIdx_ = 0

    private topNavItems_: SingleNav[] = []
    private midNavItems_: SingleNav[] = []
    private bnrNavItems_: SingleNavBnr[] = []

    //----中间部分单个展示的显示动效专用-----
    private showTransIdx_ = 0 //单个展示播放动效的索引，midNavItems使用
    private transRandIdxArr_ = []
    private showTimer_ = 0
    private stepTimer_ = 0
    private bShowItems_ = false

    private colPitch_ = 0

    private bName_ = false
    private nameClr_ = ''

    private updTopTimer_ = 0 //计时器
    private updMidTimer_ = 0 //计时器
    private updBnrTimer_ = 0

    private bTopScroll_ = false
    private bMidScroll_ = false
    private bBnrScroll_ = false

    private bMidDown_ = true

    private bInited_ = false

    constructor()
    {
        let c = fgui.UIPackage.createObject('HDSDK', 'HorPage')
        if(c)
        {
            this.com_ = c.asCom
            this.com_.visible = false
            c.sortingOrder = UIHierarchy.kExportPage

            let bs = this.com_.getChild('bnrShow').asCom
            if(bs)
            {
                this.topScroll_ = bs.getChild('horScroll').asCom
                this.topScroll_.on(fgui.Event.SCROLL, this._onTopScrolling, this)
                this.topScroll_.on(fgui.Event.SCROLL_END, this._onTopScrollEnd, this)

                this.bnrScroll_ = bs.getChild('verScroll').asCom
                this.bnrScroll_.on(fgui.Event.SCROLL, this._onBnrScrolling, this)
                this.bnrScroll_.on(fgui.Event.SCROLL_END, this._onBnrScrollEnd, this)
            }
            
            let ms = this.com_.getChild('scroll')
            if(ms)
            {
                this.midScroll_ = ms.asCom
                this.midScroll_.on(fgui.Event.SCROLL, this._onMidScrolling, this)
                this.midScroll_.on(fgui.Event.SCROLL_END, this._onMidScrollEnd, this)
            }

            //注册了Event.SCROLL后会派发一次，导致onScrolling在update更新一次之后会执行到，bScroll_被设置为true，无法自动滚动
            //此处设置一个定时器恢复bScroll_状态
            TimedTaskInst.add(()=>{ 
                this.bBnrScroll_ = false 
                this.bMidScroll_ = false
                this.bTopScroll_ = false
            }, 0.5)

            this.blockCom_ = this.com_.getChild('block').asCom
            let bg = this.blockCom_.getChild('bg')
            if(bg)
                bg.visible = false

            this.closeBtn_ = this.com_.getChild('closeBtn').asButton
            this.closeBtn_.onClick(this._onClose, this)

            this.prevBtn_ = this.com_.getChild('prevBtn').asButton
            this.prevBtn_.onClick(this._onPrev, this)

            this.nextBtn_ = this.com_.getChild('nextBtn').asButton
            this.nextBtn_.onClick(this._onNext, this)

            this.tabCtrl_ = this.com_.getController('tab')
            this.tabGrp_ = this.com_.getChild('TabGrp').asGroup
        }
    }

    init(navDatArr: HDNavData[], bnrDatArr: HDNavData[], parent: FGUICom, bName = false, nameClr = '')
    {
        if(this.com_ && !this.bInited_)
        {
            this.com_.setSize(parent.width, parent.height)
            parent.addChild(this.com_)

            this.navDatArr_ = navDatArr
            this.bnrDatArr_ = bnrDatArr

            //4个以上的banner导出才会有两个页面
            if(bnrDatArr.length < kHPBnrC * kHPBnrR)
            {
                this.prevBtn_.visible = false
                this.nextBtn_.visible = false
                this.tabGrp_.visible = false
            }
            else
            {
                this.prevBtn_.visible = true
                this.nextBtn_.visible = true
                this.tabGrp_.visible = true
            }

            this.bName_ = bName
            this.nameClr_ = nameClr

            if(G.isTMSDK)
            {

            }
            else
            {
                this._initIcons()
            }

            this.hide()

            this.bInited_ = true
        }
    }

    /**
     * 添加附加的一些功能参数，比如点击跳转后失败处理回调
     * @param navSucCb 跳转成功回调
     * @param navFailCb 跳转失败（取消）回调
     * @param tt 动效播放种类，默认无
     * @param tranDura 多久播放一次动效，默认5s
     */
    appendExtraFunc(navSucCb?: Function, navFailCb?: Function, tt = ExportTransType.kNone, transDura = 5)
    {
        for(let i = 0; i < this.topNavItems_.length; ++i)
        {
            this.topNavItems_[i].appendExtraFunc(navSucCb, navFailCb, tt, -1, transDura)
        }

        for(let i = 0; i < this.midNavItems_.length; ++i)
        {
            this.midNavItems_[i].appendExtraFunc(navSucCb, navFailCb, tt, -1, transDura)
        }

        for(let i = 0; i < this.bnrNavItems_.length; ++i)
        {
            this.bnrNavItems_[i].appendExtraFunc(navSucCb, navFailCb, tt, -1, transDura)
        }
    }

    update(dt)
    {
        if(this.com_.visible)
        {
            if(this.bShowItems_)
            {
                this.showTimer_ += dt
                this.stepTimer_ += dt
                
                if(this.stepTimer_ >= 0.02 && this.showTransIdx_ < this.midNavItems_.length)
                {
                    if(this.transRandIdxArr_[this.showTransIdx_] != null)
                    {
                        let idx = this.transRandIdxArr_[this.showTransIdx_]
                        if(this.midNavItems_[idx])
                            this.midNavItems_[idx].playTrans(ExportTransType.kFade)
                    }

                    this.stepTimer_ -= 0.02
                    ++this.showTransIdx_
                }

                if(this.showTimer_ >= 0.4)
                {
                    for(let i = 0; i < this.midNavItems_.length; ++i)
                    {
                        if(i < kHPCol * kHPRow)
                            this.midNavItems_[i].alpha = 1
                    }

                    this.bShowItems_ = false
                    this.showTimer_ = 0

                    this.blockCom_.visible = false
                }
            }
            else
            {
                if(this.tabCtrl_.selectedIndex === 1)
                {
                    for(let i = 0; i < this.topNavItems_.length; ++i)
                        this.topNavItems_[i].update(dt)

                    if(!this.bTopScroll_)
                    {
                        this.updTopTimer_ += dt
                        if(this.updTopTimer_ >= kHPTopUpdDura)
                        {
                            this.bTopScroll_ = true
                            this.updTopTimer_ = 0

                            if(this.topScroll_.scrollPane.percX == 1)
                            {
                                this.topScroll_.scrollPane.scrollLeft(this.topNavItems_.length, true)
                            }
                            else
                            {
                                this.topScroll_.scrollPane.scrollStep = kSWid + kHPColPitch
                                this.topScroll_.scrollPane.scrollRight(1, true)
                            }
                        }
                    }

                    for(let i = 0; i < this.bnrNavItems_.length; ++i)
                        this.bnrNavItems_[i].update(dt)

                    if(!this.bBnrScroll_)
                    {
                        this.updBnrTimer_ += dt
                        if(this.updBnrTimer_ >= kHPMidUpdDura)
                        {
                            this.bBnrScroll_ = true
                            this.updBnrTimer_ = 0

                            if(this.bnrScroll_.scrollPane.percY == 1)
                            {
                                this.bnrScroll_.scrollPane.scrollTop(true)
                            }
                            else
                            {
                                this.bnrScroll_.scrollPane.scrollStep = (kBNHgt + kHPRowPitch)
                                this.bnrScroll_.scrollPane.scrollDown(1, true)
                            }
                        }
                    }
                }
                else
                {
                    for(let i = 0; i < this.midNavItems_.length; ++i)
                        this.midNavItems_[i].update(dt)

                    if(!this.bMidScroll_)
                    {
                        this.updMidTimer_ += dt
                        if(this.updMidTimer_ >= kHPMidUpdDura)
                        {
                            this.bMidScroll_ = true
                            this.updMidTimer_ = 0

                            if(this.midScroll_.scrollPane.percY == 1)
                            {
                                this.midScroll_.scrollPane.scrollTop(true)
                            }
                            else
                            {
                                this.midScroll_.scrollPane.scrollStep = (kSNHgt + kHPRowPitch) * kHPMidScale
                                this.midScroll_.scrollPane.scrollDown(1, true)
                            }
                        }
                    }
                }
            }
        }
    }

    show(log = '')
    {
        if(this.com_ && !this.com_.visible)
        {
            this.com_.visible = true

            this.transRandIdxArr_.sort((a, b)=>{ return Math.random() > 0.5 ? -1 : 1 })

            for(let i = 0; i < this.topNavItems_.length; ++i)
                this.topNavItems_[i].show(log, false)

            this.midNavIdx_ = G.randRange(0, this.midNavItems_.length - 1)
            for(let i = 0; i < this.midNavItems_.length; ++i)
            {
                if(i < kHPCol * kHPRow)
                    this.midNavItems_[i].alpha = 0

                this.midNavItems_[i].show(log, false)
                let dat = this._getNextMidNavData()
                if(dat)
                    this.midNavItems_[i].updateInfo(dat)
            }

            this.midScroll_.scrollPane.scrollTop(false)

            this.blockCom_.visible = true

            this.showTimer_ = 0
            this.showTransIdx_ = 0
            this.bShowItems_ = true

            this.tabCtrl_.selectedIndex = 0

            ExportUI.instance.uploadLog(log, '展示')
        }
    }

    showTM(posId: string)
    {
        wx.tmSDK.getFlowConfig({
            positionId: posId
        }).then((config) => {
            if(config.isOpen)
            {
                console.log('[HPageShow showTM] download data')

                let cArr = config.creatives
                if(cArr)
                {
                    this._tmSdkDataProc(cArr)

                    this.show()
                }
            }
        })
    }

    hide()
    {
        if(this.com_)
            this.com_.visible = false
    }

    private _tmSdkDataProc(cArr: any)
    {
        if(this.navDatArr_.length != cArr.length)
        {
            console.log('[HPageShow _tmSdkDataProc] data length different')

            this.navDatArr_ = []
            this.midNavItems_ = []
            this.midScroll_.removeChildren()
        }

        for(let i = 0; i < cArr.length; ++i)
        {
            let dat = null
            if(this.topNavItems_.length > 0)
            {
                dat = this.navDatArr_[i] || new HDNavData()
            }
            else
                dat = new HDNavData()

            if(cArr[i].show_config)
            {
                dat.img = cArr[i].show_config.image
                dat.name = cArr[i].show_config.title
            }

            dat.tmPosId = cArr[i].positionId
            dat.tmCid = cArr[i].creativeId

            //不存在数据才压入数组，否则应该是刷新数组
            if(!this.navDatArr_[i])
                this.navDatArr_.push(dat)
        }

        if(this.midNavItems_.length > 0)
        {
            for(let i = 0; i < this.midNavItems_.length; ++i)
            {
                let dat = this._getNextMidNavData()
                if(dat)
                {
                    this.midNavItems_[i].updateInfo(dat)
                }
            }
        }
        else
        {
            this._initIcons()
        }
    }

    private _tmRefreshCallback(creatives: any, posId: string)
    {
        let cArr = creatives
        if(cArr)
        {
            console.log('[HPageShow _tmRefreshCallback]')

            this._tmSdkDataProc(cArr)
        }
    }

    private _initIcons()
    {
        //mid fill
        this.colPitch_ = (this.midScroll_.width - kHPCol * kSNWid * kHPMidScale) / (kHPCol - 1)

        let midCnt = this.navDatArr_.length > kHPCol * kHPRow ? this.navDatArr_.length : kHPCol * kHPRow
        let r = 0
        let c = 0
        for(let i = 0; i < midCnt; ++i)
        {
            this._createMidSingle(r, c, this.midScroll_)

            if(i < kHPCol * kHPRow)
            {
                this.transRandIdxArr_[i] = i
            }

            ++c
            if(c >= kHPCol)
            {
                ++r
                c = 0
            }
        }

        if(!G.isTMSDK)
        {
            for(let i = 0; i < this.navDatArr_.length; ++i)
            {
                this._createTopSingle(0, i, this.topScroll_)
            }
            this.topScroll_.scrollPane.scrollLeft()

            r = 0
            c = 0
            for(let i = 0; i < this.bnrDatArr_.length; ++i)
            {
                this._createBnrSingle(r, c, this.bnrScroll_)

                ++c
                if(c >= kHPBnrC)
                {
                    ++r
                    c = 0
                }
            }
        }
    }

    private _onTopScrolling()
    {
        if(this.updTopTimer_ > 0)
            this.bTopScroll_ = true
    }

    private _onTopScrollEnd()
    {
        this.bTopScroll_ = false
        this.updTopTimer_ = 0
    }

    private _onMidScrolling()
    {
        if(this.updMidTimer_ > 0)
            this.bMidScroll_ = true
    }

    private _onMidScrollEnd()
    {
        this.bMidScroll_ = false
        this.updMidTimer_ = 0
    }

    private _onBnrScrolling()
    {
        if(this.updBnrTimer_ > 0)
            this.bBnrScroll_ = true
    }

    private _onBnrScrollEnd()
    {
        this.bBnrScroll_ = false
        this.updBnrTimer_ = 0
    }

    private _onShowOver()
    {
        this.blockCom_.visible = false
    }

    private _onClose()
    {
        ExportUI.instance.hidePage()
    }

    private _onPrev()
    {
        let idx = this.tabCtrl_.selectedIndex
        --idx
        if(idx < 0)
            this.tabCtrl_.selectedIndex = 1
        else
            this.tabCtrl_.selectedIndex = idx
    }

    private _onNext()
    {
        let idx = this.tabCtrl_.selectedIndex
        ++idx
        if(idx > 1)
            this.tabCtrl_.selectedIndex = 0
        else
            this.tabCtrl_.selectedIndex = idx
    }

    protected _createTopSingle(r: number, c: number, parent: FGUICom)
    {
        let dat = this._getNextTopNavData()
        if(dat)
        {
            let scl = kVPTopScale

            let nav: SingleNav = null
            if(this.bName_)
            {
                let com = fgui.UIPackage.createObject('HDSDK', 'NavItemEx').asCom
                nav = new SingleNavEx(com)
                nav.init(dat, true, this.nameClr_)
                nav.setCancelJumpActive(false)
                nav.addToParent(parent, (c * kSNWid) * scl  + c * kVPColPitch, 0, scl)
                nav.show()
            }
            else
            {
                let com = fgui.UIPackage.createObject('HDSDK', 'NavItem').asCom
                nav = new SingleNav(com)
                nav.init(dat, true)
                nav.setCancelJumpActive(false)
                nav.addToParent(parent, (c * kSWid) * scl  + c * kVPColPitch, 0, scl)
                nav.show()
            }

            if(nav)
                this.topNavItems_.push(nav)
        }
    }

    private _createMidSingle(r: number, c: number, parent: FGUICom)
    {
        let dat = this._getNextMidNavData()
        if(dat)
        {
            let com = fgui.UIPackage.createObject('HDSDK', 'NavItemEx').asCom
            let nav = new SingleNavEx(com)
            nav.init(dat, true)
            nav.setCancelJumpActive(false)
            nav.addToParent(parent, c * kSNWid * kHPMidScale + c * this.colPitch_, 
                (r * kSNHgt + r * kHPRowPitch) * kHPMidScale, kHPMidScale)
            nav.appendExtraFunc(null, null, dat.tag === 1 ? ExportTransType.kSpring : ExportTransType.kNone)
            nav.show()
            nav.registerTMSDKRefreshCallback(this._tmRefreshCallback.bind(this))
            
            this.midNavItems_.push(nav)
        }
    }

    private _createBnrSingle(r: number, c: number, parent: FGUICom)
    {
        let dat = this._getNextBnrNavData()
        if(dat)
        {
            let com = fgui.UIPackage.createObject('HDSDK', 'NavBnr').asCom
            let nav = new SingleNavBnr(com)
            nav.init(dat, true)
            nav.setCancelJumpActive(false)
            nav.addToParent(parent, c * kBNWid + c * kHPBnrCP, 
                (r * kBNHgt + r * kHPRowPitch), 1)
            nav.appendExtraFunc(null, null, dat.tag === 1 ? ExportTransType.kSpring : ExportTransType.kNone)
            nav.show()
            
            this.bnrNavItems_.push(nav)
        }
    }
    
    private _getNextTopNavData()
    {
        let ret = null

        if(this.navDatArr_.length > 0)
        {
            ret = this.navDatArr_[this.topNavIdx_]

            ++this.topNavIdx_
            if(this.topNavIdx_ >= this.navDatArr_.length)
                this.topNavIdx_ = 0
        }

        return ret
    }

    private _getNextMidNavData()
    {
        let ret = null

        if(this.navDatArr_.length > 0)
        {
            ret = this.navDatArr_[this.midNavIdx_]

            ++this.midNavIdx_
            if(this.midNavIdx_ >= this.navDatArr_.length)
                this.midNavIdx_ = 0
        }

        return ret
    }

    private _getNextBnrNavData()
    {
        let ret = null

        if(this.bnrDatArr_.length > 0)
        {
            ret = this.bnrDatArr_[this.bnrNavIdx_]

            ++this.bnrNavIdx_
            if(this.bnrNavIdx_ >= this.bnrDatArr_.length)
                this.bnrNavIdx_ = 0
        }

        return ret
    }
}

class VFakePage {
    private com_: FGUICom = null

    private lst_: FGUIList = null

    private closeBtn_: FGUIButton = null
    private platCtrl_: FGUICtrl = null

    private navDatArr_: HDNavData[] = []
    private topNavIdx_ = 0 //顶部展示区跳转数据索引

    private navItems_: FakeNav[] = []

    private missDownY_ = 0
    private bMissingClick_ = false

    private bInited_ = false

    constructor()
    {
        let c = fgui.UIPackage.createObject('HDSDK', 'VFakePage')
        if(c)
        {
            this.com_ = c.asCom
            this.com_.visible = false
            c.sortingOrder = UIHierarchy.kExportPage
            
            this.platCtrl_ = this.com_.getController('plat')
            if(G.isMinigamePlat)
            {
                let wxsdk = WxUtil.sdkInfo
                if(wxsdk.platform == "ios")
                    this.platCtrl_.selectedIndex = 0
                else
                    this.platCtrl_.selectedIndex = 1
            }

            let content = this.com_.getChild('content').asCom
            if(content)
                this.lst_ = content.getChild('list').asList

            this.closeBtn_ = this.com_.getChild('closeBtn').asButton
            this.closeBtn_.onClick(this._onClose, this)
        }
    }

    init(navDatArr: HDNavData[], parent: FGUICom)
    {
        if(this.com_ && !this.bInited_)
        {
            this.com_.setSize(parent.width, parent.height)
            parent.addChild(this.com_)

            this.navDatArr_ = navDatArr

            if(G.isTMSDK)
            {

            }
            else
            {
                this.lst_.defaultItem = 'ui://HDSDK/NavFake'

            	this.lst_.itemRenderer = this._onLstRenderItem.bind(this)
                this.lst_.numItems = this.navDatArr_.length
            }

            this.hide()

            this.bInited_ = true
        }
    }

    /**
     * 添加附加的一些功能参数，比如点击跳转后失败处理回调
     * @param navSucCb 跳转成功回调
     * @param navFailCb 跳转失败（取消）回调
     */
    appendExtraFunc(navSucCb?: Function, navFailCb?: Function)
    {
        for(let i = 0; i < this.navItems_.length; ++i)
        {
            this.navItems_[i].appendExtraFunc(navSucCb, navFailCb, ExportTransType.kNone, -1, -1)
        }
    }

    show(log = '')
    {
        if(this.com_ && !this.com_.visible)
        {
            this.com_.visible = true

            this.com_.node.on(cc.Node.EventType.TOUCH_START, this._onDown, this, true)
            this.com_.node.on(cc.Node.EventType.TOUCH_MOVE, this._onMove, this, true)
            this.com_.node.on(cc.Node.EventType.TOUCH_END, this._onUp, this, true)

            for(let i = 0; i < this.navItems_.length; ++i)
                this.navItems_[i].show(log, false)

            ExportUI.instance.uploadLog(log, '展示')
        }
    }

    showTM(posId: string)
    {
        wx.tmSDK.getFlowConfig({
            positionId: posId
        }).then((config) => {
            if(config.isOpen)
            {
                console.log('[VFakePage showTM] download data')

                let cArr = config.creatives
                if(cArr)
                {
                    this._tmSdkDataProc(cArr)

                    this.show()
                }
            }
        })
    }

    hide()
    {
        if(this.com_)
        {
            this.com_.visible = false

            this.com_.node.off(cc.Node.EventType.TOUCH_START, this._onDown, this, true)
            this.com_.node.off(cc.Node.EventType.TOUCH_MOVE, this._onMove, this, true)
            this.com_.node.off(cc.Node.EventType.TOUCH_END, this._onUp, this, true)

            for(let i = 0; i < this.navItems_.length; ++i)
                this.navItems_[i].hide()
        }
    }

    private _tmSdkDataProc(cArr: any)
    {
        //依据下放的数据长度来更改原本数据的有效元素，保障运营期后台调整数据后能立即生效
        //数据比初始化时短，删掉冗余的ui节点和缓存数据，数据比初始化时长，就新增新的节点和缓存数据
        if(this.navDatArr_.length != cArr.length)
        {
            console.log('[VFakePage _tmSdkDataProc] data length different')

            this.navDatArr_ = []
            this.navItems_ = []
            this.lst_.removeChildren()
        }

        for(let i = 0; i < cArr.length; ++i)
        {
            let dat = null
            if(this.navItems_.length > 0)
            {
                dat = this.navDatArr_[i] || new HDNavData()
            }
            else
                dat = new HDNavData()

            if(cArr[i].show_config)
            {
                dat.img = cArr[i].show_config.image
                dat.name = cArr[i].show_config.title
            }

            dat.tmPosId = cArr[i].positionId
            dat.tmCid = cArr[i].creativeId

            //不存在数据才压入数组，否则应该是刷新数组
            if(!this.navDatArr_[i])
                this.navDatArr_.push(dat)
        }

        if(this.navItems_.length > 0)
        {
            for(let i = 0; i < this.navItems_.length; ++i)
            {
                let dat = this._getNextNavData()
                if(dat)
                {
                    this.navItems_[i].updateInfo(dat)
                }
            }

            // this.lst_.refreshVirtualList()
        }
        else
        {
            this.lst_.defaultItem = 'ui://HDSDK/NavFake'

            this.lst_.itemRenderer = this._onLstRenderItem.bind(this)
            this.lst_.numItems = this.navDatArr_.length
        }
    }

    private _tmRefreshCallback(creatives: any, posId: string)
    {
        let cArr = creatives
        if(cArr)
        {
            console.log('[VFakePage _tmRefreshCallback]')

            this._tmSdkDataProc(cArr)
        }
    }

    private _onLstRenderItem(index: number, obj: FGUIObj)
    {
        let dat = this._getNextNavData()
        if(dat)
        {
            let nav = new FakeNav(obj.asCom)
            nav.init(dat)
            nav.setCancelJumpActive(false)
            nav.registerTMSDKRefreshCallback(this._tmRefreshCallback.bind(this))
            
            this.navItems_.push(nav)
        }
    }

    private _onDown(evt: cc.Event.EventTouch)
    {
        this.missDownY_ = evt.getLocationY()
        this.bMissingClick_ = false
    }

    private _onMove(evt: cc.Event.EventTouch)
    {
        let offsetY = Math.abs(evt.getLocationY() - this.missDownY_)
        if(offsetY > 10 && !this.bMissingClick_)
        {
            if(G.randRange(0, 100) < DataHub.config.fakeBtnClick)
            {
                let idx = this.lst_.getFirstChildInView()
                
                let my = evt.getLocationY()
                let ly = this.lst_.localToGlobal().y
                let lh = this.lst_.height

                if(my > ly)
                {
                    let div = lh / 7
                    let i = Math.floor((my - ly) / div)

                    let nav = this.navItems_[idx + i]
                    if(nav)
                    {

                        nav.clickTrigger()

                    }
                }
            }

            this.bMissingClick_ = true
        }
    }

    private _onUp()
    {
        this.bMissingClick_ = true
    }

    private _onClose()
    {
        ExportUIInst.hideFakePage()
    }

    private _getNextNavData()
    {
        let ret = null

        if(this.navDatArr_.length > 0)
        {
            ret = this.navDatArr_[this.topNavIdx_]

            ++this.topNavIdx_
            if(this.topNavIdx_ >= this.navDatArr_.length)
                this.topNavIdx_ = 0
        }

        return ret
    }
}

const kVGTCol = 4 //顶部展示区域行列数
const kVGTRow = 3

const kVGMCol = 4 //中部展示区域行列数
const kVGMRow = 2 

const kVGTColPitch = 40 //顶部展示区域行列间距
const kVGTRowPitch = 0

const kVGMColPitch = 40 //中部展示区域行列间距
const kVGMRowPitch = 0

const kVGTopScale = 1 //顶部展示栏icon的缩放比例
const kVGMidScale = 1 //中部展示栏的icon缩放比例

const bVGMissingClick = true //是否激活滑动误点
const kVGBnrMissClick = true //是否开启banner误点

//竖屏格子页面
class VGridPage extends VPageShow {
    private topShowTransIdx_ = 0
    private topTransRandIdxArr_: number[] = []

    private topGrids_ = 0

    constructor()
    {
        super(true)

        this.bExportMissClick_ = bVGMissingClick
        this.bBnrMissClick_ = kVGBnrMissClick

        let c = fgui.UIPackage.createObject('HDSDK', 'VGridPage')
        if(c)
        {
            this.com_ = c.asCom
            this.com_.visible = false
            c.sortingOrder = UIHierarchy.kExportPage

            let ts = this.com_.getChild('topScroll').asCom
            if(ts)
            {
                this.topScroll_ = ts.asCom
                this.topScroll_.on(fgui.Event.SCROLL, this._onTopScrolling, this)
                this.topScroll_.on(fgui.Event.SCROLL_END, this._onTopScrollEnd, this)
            }
            
            let ms = this.com_.getChild('midScroll')
            if(ms)
            {
                this.midScroll_ = ms.asCom
                this.midScroll_.on(fgui.Event.SCROLL, this._onMidScrolling, this)
                this.midScroll_.on(fgui.Event.SCROLL_END, this._onMidScrollEnd, this)
            }

            this.blockCom_ = this.com_.getChild('block').asCom
            let bg = this.blockCom_.getChild('bg')
            if(bg)
                bg.visible = false

            // this.closeBtn_ = this.com_.getChild('closeBtn').asButton
            this.continueGameBtn_ = this.com_.getChild("continueGameBtn").asButton

            // this.closeBtn_.onClick(this, this._onClose)
            this.continueGameBtn_.onClick(this._onContinue, this)

            // this.showTrans_ = this.com_.getTransition('show')
        }
    }

    init(navDatArr: HDNavData[], parent: FGUICom, bName = false, nameClr = '')
    {
        if(this.com_ && !this.bInited_)
        {
            this.com_.setSize(parent.width, parent.height)
            parent.addChild(this.com_)

            this.navDatArr_ = navDatArr

            this.bName_ = bName
            this.nameClr_ = nameClr

            if(G.isTMSDK)
            {

            }
            else
            {
                this._initIcons()
            }

            this.hide()

            this.bInited_ = true
        }
    }

    update(dt)
    {
        if(this.com_ && this.com_.visible)
        {
            if(this.bShowItems_)
            {
                this.showTimer_ += dt
                this.stepTimer_ += dt
                
                if(this.stepTimer_ >= 0.03)
                {
                    if(this.topShowTransIdx_ < this.topNavItems_.length)
                    {
                        if(this.topTransRandIdxArr_[this.topShowTransIdx_] != null)
                        {
                            let idx = this.topTransRandIdxArr_[this.topShowTransIdx_]
                            if(this.topNavItems_[idx])
                                this.topNavItems_[idx].playTrans(ExportTransType.kFade)
                        }

                        ++this.topShowTransIdx_
                    }

                    if(this.showTransIdx_ < this.midNavItems_.length)
                    {
                        if(this.transRandIdxArr_[this.showTransIdx_] != null)
                        {
                            let idx = this.transRandIdxArr_[this.showTransIdx_]
                            if(this.midNavItems_[idx])
                                this.midNavItems_[idx].playTrans(ExportTransType.kFade)
                        }

                        ++this.showTransIdx_
                    }

                    this.stepTimer_ -= 0.03
                }

                if(this.showTimer_ >= 0.5)
                {
                    for(let i = 0; i < this.topNavItems_.length; ++i)
                    {
                        if(i < this.topGrids_)
                            this.topNavItems_[i].alpha = 1
                    }

                    for(let i = 0; i < this.midNavItems_.length; ++i)
                    {
                        if(i < this.midGrids_)
                            this.midNavItems_[i].alpha = 1
                    }

                    this.bShowItems_ = false
                    this.showTimer_ = 0
                }
            }
            else
            {
                for(let i = 0; i < this.topNavItems_.length; ++i)
                {
                    this.topNavItems_[i].update(dt)
                }

                for(let i = 0; i < this.midNavItems_.length; ++i)
                {
                    this.midNavItems_[i].update(dt)
                }
            }
        }
    }

    show(log = '')
    {
        if(this.com_ && !this.com_.visible)
        {
            this.topTransRandIdxArr_.sort((a, b)=>{ return Math.random() > 0.5 ? -1 : 1 })

            this.topNavIdx_ = G.randRange(0, this.topNavItems_.length - 1)
            for(let i = 0; i < this.topNavItems_.length; ++i)
            {
                if(i < this.topGrids_)
                    this.topNavItems_[i].alpha = 0

                this.topNavItems_[i].show(log, false)
                let dat = this._getNextTopNavData()
                if(dat)
                    this.topNavItems_[i].updateInfo(dat)
            }

            this.topShowTransIdx_ = 0
        }

        super.show(log)
    }

    protected _createTopSingle(r: number, c: number, parent: FGUICom)
    {
        let dat = this._getNextTopNavData()
        if(dat)
        {
            let com = fgui.UIPackage.createObject('HDSDK', 'NavItemCnt').asCom
            let nav = new CountNav(com)
            nav.init(dat, false, '#000000', false)
            nav.setCancelJumpActive(false)
            nav.randomCount(true)
            //注意带名字的宽高不同
            nav.addToParent(parent, c * kSNWid * kVGTopScale + c * this.colPitch_, 
                (r * kSNCHgt + r * kVGTRowPitch) * kVGTopScale, kVGTopScale)
            nav.appendExtraFunc(null, null, ExportTransType.kShake, -1, G.randRange(3, 10))
            nav.show()
            nav.registerTMSDKRefreshCallback(this._tmRefreshCallback.bind(this))

            this.topNavItems_.push(nav)
        }
    }

    protected _createMidSingle(r: number, c: number, parent: FGUICom)
    {
        let dat = this._getNextMidNavData()
        if(dat)
        {
            let com = fgui.UIPackage.createObject('HDSDK', 'NavItemCnt').asCom
            let nav = new CountNav(com)
            nav.init(dat, false, '#0000000', false)
            nav.setCancelJumpActive(false)
            nav.randomCount(false)
            //注意带名字的宽高不同
            nav.addToParent(parent, c * kSNWid * kVGMidScale + c * this.colPitch_, 
                (r * kSNCHgt + r * kVGMRowPitch) * kVGMidScale, kVGMidScale)
            nav.appendExtraFunc(null, null, ExportTransType.kShake, -1, G.randRange(3, 10))
            nav.show()
            nav.registerTMSDKRefreshCallback(this._tmRefreshCallback.bind(this))
            
            this.midNavItems_.push(nav)
        }
    }

    protected _initIcons()
    {
        this.colPitch_ = (this.midScroll_.width - kVGTCol * kSNWid * kVGTopScale) / (kVGTCol - 1)

        this.topGrids_ = kVGTCol * kVGTRow
        let topCnt = this.navDatArr_.length > this.topGrids_ ? this.navDatArr_.length : this.topGrids_
        let r = 0
        let c = 0
        for(let i = 0; i < topCnt; ++i)
        {
            this._createTopSingle(r, c, this.topScroll_)

            if(i < this.topGrids_)
            {
                this.topTransRandIdxArr_[i] = i
            }

            ++c
            if(c >= kVGTCol)
            {
                ++r
                c = 0
            }
        }

        //mid fill
        this.colPitch_ = (this.midScroll_.width - kVGMCol * kSNWid * kVGMidScale) / (kVGMCol - 1)

        this.midGrids_ = kVGMCol * kVGMRow
        let midCnt = this.navDatArr_.length > this.midGrids_ ? this.navDatArr_.length : this.midGrids_
        r = 0
        c = 0
        for(let i = 0; i < midCnt; ++i)
        {
            this._createMidSingle(r, c, this.midScroll_)

            if(i < this.midGrids_)
            {
                this.transRandIdxArr_[i] = i
            }

            ++c
            if(c >= kVGMCol)
            {
                ++r
                c = 0
            }
        }
    }

    protected _onContinue()
    {
        if(this.bBnrMissClick_)
        {
            if(this.bBnrJump_ && ExportUIInst.getPageBannerID() != '')
            {
                if(this.bBnrJumping_)
                {
                    
                }
                else
                    ExportUIInst.hideGridPage()
            }
            else
                ExportUIInst.hideGridPage()
        }
        else
            ExportUIInst.hideGridPage()
    }
}

const kNameLib = 'https://huandong-1257458597.cos.ap-guangzhou.myqcloud.com/GameRes/WxLikeness/NameCfg/name.json'
const kIconLib = 'https://huandong-1257458597.cos.ap-guangzhou.myqcloud.com/GameRes/WxLikeness/'

class InvitePage {
    private com_: FGUICom = null

    private clipFrame_: FGUICom = null
    private userName_: FGUITextField = null
    private userIcon_: FGUILoader = null
    private userTip_: FGUITextField = null
    private showTrans_: FGUITrans = null
    private hideTrans_: FGUITrans = null
    private confirmBtn_: FGUIButton = null
    private cancalBtn_: FGUIButton = null
    private navDatArr_: HDNavData[] = []

    private navDatIdx_ = 0 //跳转数据取值索引
    private navItem_: SingleNav = null

    private nameJson_ = null
    private iconUrl_ = null

    private userIdx_ = 0

    private bInited_ = false

    constructor()
    {
        this.com_ = fgui.UIPackage.createObject('HDSDK', 'InvitePnl').asCom
        this.com_.visible = false

        this.clipFrame_ = this.com_.getChild('clipFrame').asCom
        this.userName_ = this.com_.getChild('userName').asTextField
        this.userIcon_ = this.com_.getChild('userIcon').asLoader
        this.userTip_ = this.com_.getChild('userTip').asTextField
        this.showTrans_ = this.com_.getTransition('show')
        this.hideTrans_ = this.com_.getTransition('hide')
        this.confirmBtn_ = this.com_.getChild('confirmBtn').asButton
        this.cancalBtn_ = this.com_.getChild('cancalBtn').asButton
    }

    init(navDatArr: HDNavData[], parent: FGUICom, bName = false, nameClr = '')
    {
        if(this.com_ && !this.bInited_)
        {
            this.com_.setSize(parent.width, parent.height)
            parent.addChild(this.com_)

            this.navDatArr_ = navDatArr

            this.cancalBtn_.onClick(this.hide, this)

            this.confirmBtn_.onClick(this._confirm, this)

            this.bInited_ = true

            cc.loader.load(kNameLib, null, (err, res: cc.JsonAsset)=> {
                if(err)
                {
                }
                else
                    this._loadName(res)
            })
        }
    }

    private _loadName(names)
    {
        if(names)
        {
            this.nameJson_ = names
        }
    }

    show(log = '')
    {
        this.userIdx_ = G.randRange(1,100)
        let userName = this.nameJson_ ? this.nameJson_[this.userIdx_].name : '你的名字'
        this.userName_.text = userName
        this.userTip_.setVar('name', userName).flushVars()
        this.userIcon_.url = kIconLib + this.userIdx_ + '.png'
        this._createSingle()
        this.com_.visible = true
        this.showTrans_.play()
    }

    showTM(posId)
    {
        wx.tmSDK.getFlowConfig({
            positionId: posId
        }).then((config) => {
            if(config.isOpen)
            {
                console.log('[InvitePage showTM] download data')

                let cArr = config.creatives
                if(cArr)
                {
                    this._tmSdkDataProc(cArr)

                    this.show()
                }
            }
        })
    }

    hide()
    {
        this.hideTrans_.play(() => {
            this.com_.visible = false
        })
    }

    private _confirm()
    {
        this.navItem_ && this.navItem_.clickTrigger()
    }

    private _tmSdkDataProc(cArr: any)
    {
        if(this.navDatArr_.length != cArr.length)
        {
            console.log('[InvitePage _tmSdkDataProc] data length different')

            this.navDatArr_ = []
        }

        for(let i = 0; i < cArr.length; ++i)
        {
            let dat = new HDNavData()

            if(cArr[i].show_config)
            {
                dat.img = cArr[i].show_config.image
                dat.name = cArr[i].show_config.title
            }

            dat.tmPosId = cArr[i].positionId
            dat.tmCid = cArr[i].creativeId

            //不存在数据才压入数组，否则应该是刷新数组
            if(!this.navDatArr_[i])
                this.navDatArr_.push(dat)
        }
    }

    private _createSingle(iconScl = 2)
    {
        let dat = this._getNextNavData()
        if(dat)
        {
            let scl = iconScl

            let nav: SingleNav = null
            let com = fgui.UIPackage.createObject('HDSDK', 'NavItem').asCom
            nav = new SingleNav(com, true)
            nav.init(dat, false)
            nav.addToParent(this.clipFrame_, this.clipFrame_.width / 2 - (kSWid * scl) / 2, 
                this.clipFrame_.height / 2 - (kSHgt * scl) / 2, scl)
            nav.show()

            this.navItem_ = nav
        }
    }

    private _getNextNavData()
    {
        let ret = null

        if(this.navDatArr_.length > 0)
        {
            ret = this.navDatArr_[this.navDatIdx_]

            ++this.navDatIdx_
            if(this.navDatIdx_ >= this.navDatArr_.length)
                this.navDatIdx_ = 0
        }

        return ret
    }
}