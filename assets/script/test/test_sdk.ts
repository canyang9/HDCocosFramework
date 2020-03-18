import { FGUIRoot } from "../game_ui/common/fgui_root";
import { SettingUI } from "../game_ui/common/setting_ui";
import { SignInUI } from "../game_ui/common/sign_in_ui";
import { LuckyBoxUI } from "../game_ui/common/lucky_box_ui";
import { WxUtil } from "../util/wx_util";
import { HDBannerAd, HDVideoAd } from "../util/ad_tools";
import { DataHub } from "../data/data_hub";
import { ExportUIInst, ExportUIName, ExportGroupName, ExportGroup, ExportTransType, ExportTmID } from "../game_ui/common/export_ui";
import { GameUserInfo } from "../game/user_info";
import { G } from "../util/global_def";
import { TipUI } from "../game_ui/common/tip_ui";
import { AudioMgrInst, BgmType, SfxType } from "../util/audio_mgr";
import { TimedTaskInst } from "../util/timed_task";


const {ccclass, property} = cc._decorator;

@ccclass
export default class TestSDK extends cc.Component {
    private homePnl_: FGUICom = null

    private startBtn_: FGUIButton = null
    private signInBtn_: FGUIButton = null
    private settingBtn_: FGUIButton = null
    private boxBtn_: FGUIButton = null

    private settingUI_: SettingUI = null
    private signInUI_: SignInUI = null

    private box_: LuckyBoxUI = null

    private videoBonus_: VideoBoxBonus = null

    private bLocked_ = false

    private bPreload_ = false

    start()
    {
        fgui.UIPackage.loadPackage(FGUIRoot.nativePath + "HomeHUD", this._onLoadedUI.bind(this))
    }

    update(dt)
    {
        if(this.videoBonus_)
            this.videoBonus_.updateCounter(dt)
    }

    private _onLoadedUI()
    {
        let fguiNode = fgui.GRoot.inst

        let fguiUP = fgui.UIPackage
        fguiUP.addPackage(FGUIRoot.nativePath + "HomeHUD")
        this.homePnl_ = fguiUP.createObject('HomeHUD', 'HomePnl').asCom
        this.homePnl_.setSize(cc.view.getVisibleSize().width, cc.view.getVisibleSize().height)

        if(this.homePnl_)
        {
            fguiNode.addChild(this.homePnl_)

            this.startBtn_ = this.homePnl_.getChild('startBtn').asButton
            this.signInBtn_ = this.homePnl_.getChild('signInBtn').asButton
            this.settingBtn_ = this.homePnl_.getChild('settingBtn').asButton
            this.boxBtn_ = this.homePnl_.getChild('freeBoxBtn').asButton

            this.startBtn_.onClick(this._onClick, this)
            this.signInBtn_.onClick(this._onClick, this)
            this.settingBtn_.onClick(this._onClick, this)
            this.boxBtn_.onClick(this._onClick, this)

            this.settingUI_ = SettingUI.instance

            this.signInUI_ = new SignInUI()
            this.signInUI_.init(this.homePnl_.getChild('signInPnl').asCom)

            this.box_ = new LuckyBoxUI()
            this.box_.init(this.homePnl_.getChild('awardBox').asCom)

            this.videoBonus_ = new VideoBoxBonus(this.boxBtn_)
            this.videoBonus_.refresh()

            this.homePnl_.visible = false

            let bnrBaseLine = this.homePnl_.getChild('bnrBaseLine')
            if(bnrBaseLine)
            {
                this.bPreload_ = true

                WxUtil.preloadBanner(HDBannerAd.kB1, bnrBaseLine, 300, DataHub.config.bnrGap, 
                    this._bnrLoaded.bind(this), this._bnrLoadError.bind(this), 1, DataHub.config.bnrRefresh)
            }
        }
    }

    private _bnrLoaded()
    {
        ExportUIInst.initPage()

        let homeSGrp = [ ExportUIName.kSL1, ExportUIName.kSL2, ExportUIName.kSR1, ExportUIName.kSR2 ]
        ExportGroup.addMembers(ExportGroupName.kHS4, homeSGrp)

        for(let i = 0; i < homeSGrp.length; ++i)
            ExportUIInst.bindSingleEx(homeSGrp[i], this.homePnl_, ExportTransType.kPop)

        ExportUIInst.bindRCScroll(ExportUIName.kHT, this.homePnl_, 0, 10, ExportUIInst.normNavDataIndex)

        ExportUIInst.bindFoldPageEx(ExportUIName.kFP, this.homePnl_, 3, -5, -5, '#000000',
            this._hideFoldBnr.bind(this), this._showFoldBnr.bind(this))
    
        ExportUIInst.bindPop4x3Ex(ExportUIName.kPop, this.homePnl_, 5, -15, '#ffffff')

        ExportUIInst.bindGuessLike(ExportUIName.kLike, this.homePnl_)
    
        ExportUIInst.bindMoreGameButton(ExportUIName.kHomeNS, this.homePnl_, 0, false)

        ExportUIInst.bindFakeCloseButton(ExportUIName.kFake, this.homePnl_)

        let homeAllGrp = [ ExportUIName.kFP, ExportUIName.kHT, ExportUIName.kPop, ExportUIName.kFake ]
        homeAllGrp = homeAllGrp.concat(homeSGrp)

        ExportGroup.addMembers(ExportGroupName.kHomeAll, homeAllGrp)

        this._enter()
    }

    private _bnrLoadError()
    {
        if(this.bPreload_)
            this._bnrLoaded()
    }

    private _enter()
    {
        if(this.homePnl_)
        {
            this.bPreload_ = false

            this.node.active = true

            this.homePnl_.visible = true

            if(G.isTMSDK)
            {
                //设置默认的独立页广告位id
                ExportUIInst.defaultPageTmID = ExportTmID.kCancel

                ExportGroup.showMembersTM(ExportGroupName.kHS4, ExportTmID.kSingles)
                ExportUIInst.showTM(ExportUIName.kHT, ExportTmID.kHT)

                ExportUIInst.showTM(ExportUIName.kFake, ExportTmID.kPage)
                ExportUIInst.showTM(ExportUIName.kHomeNS, ExportTmID.kPage)

                ExportUIInst.showTM(ExportUIName.kLike, ExportTmID.kLike)

                ExportUIInst.showTM(ExportUIName.kFP, ExportTmID.kFold)
                ExportUIInst.autoPopFoldPage(ExportUIName.kFP)

                ExportUIInst.showTM(ExportUIName.kPop, ExportTmID.kForce)
            }
            else
            {
                ExportGroup.showMembers(ExportGroupName.kHomeAll)
                ExportUIInst.show(ExportUIName.kHomeNS)

                ExportUIInst.show(ExportUIName.kLike)
                
                ExportUIInst.autoPopFoldPage(ExportUIName.kFP)
            }

            ExportUIInst.addPageCallback(this._hideBnr, this._showBnr)
        }
    }

    private _leave()
    {
        
    }

    private _onClick(evt: cc.Event)
    {
        if(this.bLocked_)
            return

        if(fgui.GObject.cast(evt.currentTarget) == this.startBtn_) 
        {
            if(G.isTMSDK)
            {
                ExportUIInst.showInvitePage("", ExportTmID.kPage)
            }
            else
            {
                ExportUIInst.showInvitePage("", ExportTmID.kPage)
                
                // let dat = ExportUIInst.getForceNavData
                // if(dat)
                // {
                //     ExportUIInst.navigate(dat)
                // }
                // else
                //     ExportUIInst.forcePopFakePage(null)
            }
        }
        else if(fgui.GObject.cast(evt.currentTarget) == this.signInBtn_) 
        {
            if(this.signInUI_)
                this.signInUI_.show()
        }
        else if(fgui.GObject.cast(evt.currentTarget) == this.settingBtn_)
        {
            if(this.settingUI_)
                this.settingUI_.show()
        }
        else if(fgui.GObject.cast(evt.currentTarget) == this.boxBtn_)
        {
            if(this.box_ && GameUserInfo.isVideoBoxBonus)
            {
                let r = G.randRange(1, 100)
                let rank = 3
                if(r > 70)
                    rank = 1
                else
                    rank = 2

                if(G.isWeChat)
                {
                    HDVideoAd.watchOrShare(HDVideoAd.kBox, this._awardFunc.bind(this), rank)
                }
                else
                    this._awardFunc(rank)
            }
            else
            {
                if(GameUserInfo.isVideoBoxBonusExisted)
                {
                    let fs = G.formatSecond(GameUserInfo.videoBoxBounsTime)
                    TipUI.instance.show('免费宝箱还需' + fs + '才能开启')
                }
                else
                    TipUI.instance.show('今日免费宝箱已领取完毕')
            }
        }
    }

    private _awardFunc(rank)
    {
        this.box_.show(rank, this._bonusGet.bind(this))

        WxUtil.showBanner(HDBannerAd.kB1)
    }

    private _bonusGet()
    {
        if(this.videoBonus_)
        {
            this.videoBonus_.reset()

            WxUtil.hideBanner(HDBannerAd.kB1)
        }
    }

    private _showBnr()
    {
        WxUtil.showLastOne()
    }

    private _hideBnr()
    {
        WxUtil.hideLastOne()
    }

    private _showFoldBnr()
    {
        WxUtil.showBanner(HDBannerAd.kB1)
    }

    private _hideFoldBnr()
    {
        WxUtil.hideBanner(HDBannerAd.kB1)
    }
}

class VideoBoxBonus {
    private lbl_: FGUITextField = null

    private waggleTrans_: FGUITrans = null
    private com_: FGUIButton = null

    private ctrl_: FGUICtrl = null
    private adCtrl_: FGUICtrl = null

    private saveTimer_ = 0

    private bBonus_ = false

    constructor(com: FGUIButton)
    {
        if(com)
        {
            this.com_ = com

            this.lbl_ = com.getChild('counterLbl').asTextField

            this.ctrl_ = com.getController('tipCtrl')
            this.adCtrl_ = com.getController('sh')
            this.waggleTrans_ = com.getTransition('waggleTrans')
        }
    }

    refresh()
    {
        if(GameUserInfo.isVideoBoxBonusExisted)
        {
            this.bBonus_ = false
            this.com_.grayed = false

            this.lbl_.text = Math.ceil(GameUserInfo.videoBoxBounsTime).toString()
        }
        else
        {
            this.bBonus_ = true
            this.com_.grayed = true

            this.lbl_.text = '0'
        }
    }

    updateCounter(dt)
    {
        if(!this.bBonus_)
        {
            if(GameUserInfo.isVideoBoxBonus)
            {
                this.waggleTrans_.play(null, -1)
                this.ctrl_.selectedIndex = 0

                if(this.adCtrl_)
                    this.adCtrl_.selectedIndex = GameUserInfo.isVideoLimited ? 1 : 0

                this.bBonus_ = true
            }
            else
            {
                GameUserInfo.calVideoBonusTime(dt)

                this.lbl_.text = Math.ceil(GameUserInfo.videoBoxBounsTime).toString()
            }

            ++this.saveTimer_
            if(this.saveTimer_ >= 60)
            {
                GameUserInfo.setOfflineTimestamp()

                GameUserInfo.saveSignIn()
                this.saveTimer_ = 0
            }
        }
    }

    reset()
    {
        this.waggleTrans_.stop()
        this.ctrl_.selectedIndex = 1

        GameUserInfo.resetVideoBonusTime()
        GameUserInfo.countVideoBonus()

        GameUserInfo.setOfflineTimestamp()

        GameUserInfo.saveSignIn()

        if(GameUserInfo.isVideoBoxBonusExisted)
        {
            this.bBonus_ = false
            this.com_.grayed = false
        }
        else
        {
            this.com_.grayed = true
        }
    }
}