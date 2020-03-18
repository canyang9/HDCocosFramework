import { BaseUI } from "./base_ui";
import { InputBlocker } from "./blocker_ui";
import { TipUI } from "./tip_ui";
import { LuckyBoxUI } from "./lucky_box_ui";
import { PopupUI } from "./popup_ui";
import { GameUserInfo, DailyData, BonusType, BonusInfo } from "../../game/user_info";
import { G } from "../../util/global_def";
import { WxUtil } from "../../util/wx_util";
import { GameEventMgr, EventType } from "../../util/event_mgr";
import { AudioMgr, SfxType } from "../../util/audio_mgr";
import { HDBannerAd, HDVideoAd } from "../../util/ad_tools";

class SignInItem {
    self: FGUIButton = null
    dayLbl: FGUITextField = null
    iconLoader: FGUILoader = null
    cntLbl: FGUITextField = null
    maskGrp: FGUIGroup = null
}

const kMaxItems = 7

export class SignInUI extends BaseUI {
    private awardBtn_: FGUIButton = null
    private closeBtn_: FGUIButton = null

    private awardCtrl_: FGUICtrl = null

    private box_: LuckyBoxUI = null
    private boxCom_: FGUICom = null

    private items_: SignInItem[] = []

    private showTrans_: FGUITrans = null
    private closeTrans_: FGUITrans = null

    private bInited_ = false
    private bAwarded_ = false

    init(com: FGUICom)
    {
        if(com)
        {
            this.com_ = com

            this.awardBtn_ = com.getChild('awardBtn').asButton
            this.closeBtn_ = com.getChild('closeBtn').asButton

            this.awardCtrl_ = this.awardBtn_.getController('sh')

            this.boxCom_ = com.getChild('awardBox').asCom
            if(this.boxCom_)
            {
                this.box_ = new LuckyBoxUI()
                this.box_.init(this.boxCom_)
            }

            this.showTrans_ = com.getTransition('showTrans')
            this.closeTrans_ = com.getTransition('closeTrans')

            for(let i = 0; i < kMaxItems; ++i)
            {
                let item = new SignInItem()
                let obj = com.getChild('item' + (i + 1)).asButton
                if(obj)
                {
                    item.self = obj
                    item.dayLbl = obj.getChild('dayLbl').asTextField
                    item.iconLoader = obj.getChild('iconLoader').asLoader
                    item.cntLbl = obj.getChild('cntLbl').asTextField
                    item.maskGrp = obj.getChild('maskGrp').asGroup

                    this.items_.push(item)
                }
            }

            this.com_.visible = false
        }
    }

    show()
    {
        if(this.com_)
        {
            this.com_.visible = true

            // let date = new Date()
            if(GameUserInfo.isSignInAwarded)
            {
                this.awardBtn_.grayed = true
                this.bAwarded_ = true
            }
            else
            {
                this.awardBtn_.grayed = false
                this.bAwarded_ = false
            }

            if(this.awardCtrl_)
                this.awardCtrl_.selectedIndex = GameUserInfo.isVideoLimited ? 1 : 0

            if(!this.bInited_ || GameUserInfo.isSignIn7Days)
            {
                GameUserInfo.signInAwards.each((i: number, k, info: BonusInfo)=>{
                    let item = this.items_[i]
                    if(item)
                    {
                        item.dayLbl.text = (i + 1).toString()

                        let t = info.type
                        if(t === BonusType.kCoin)
                            item.iconLoader.url = 'ui://CommUI/coin'
                        else if(t >= BonusType.kBox1 && t <= BonusType.kBox3)
                            item.iconLoader.url = 'ui://CommUI/box'
                        else if(t >= BonusType.kPiece1 && t <= BonusType.kPiece3)
                            item.iconLoader.url = 'ui://CommUI/piece' + (t - BonusType.kPiece1 + 1)

                        item.cntLbl.text = 'x' + info.count
                        item.maskGrp.visible = i < GameUserInfo.dailyDat.signInAwardCnt ? true : false

                        item.self.onClick(this._onItemClick, this)
                    }
                })

                this.bInited_ = true
            }

            this.awardBtn_.onClick(this._onAward, this)
            this.closeBtn_.onClick(this._onClose, this)

            this.bLock_ = true
            this.showTrans_.stop()
            this.showTrans_.play(()=>{ 
                this.bLock_ = false 

                WxUtil.showBanner(HDBannerAd.kB1)
            })
        }
    }

    reset()
    {
        this.com_.visible = false

        this.bLock_ = false

        this.awardBtn_.offClick(this._onAward, this)
        this.closeBtn_.offClick(this._onClose, this)

        WxUtil.hideBanner(HDBannerAd.kB1)
    }

    private _onItemClick(evt: cc.Event)
    {
        let item = null
        let idx = 0
        for(let i = 0; i < this.items_.length; ++i)
        {
            if(this.items_[i].self == fgui.GObject.cast(evt.currentTarget))
            {
                item = this.items_[i]
                idx = i
                break
            }
        }

        if(item)
        {
            let info = GameUserInfo.signInAwards.getByIndex(idx) as BonusInfo
            PopupUI.instance.show(info.desc)
        }
    }

    private _onAward()
    {
        if(this.bLock_)
            return

        if(this.bAwarded_)
        {
            this._onClose()
            return
        }

        if(G.isWeChat)
        {
            HDVideoAd.watchOrShare(HDVideoAd.kSignIn, this._getAward.bind(this))

            if(this.awardCtrl_)
                this.awardCtrl_.selectedIndex = GameUserInfo.isVideoLimited ? 1 : 0
        }
        else
        {
            this._getAward()
        }
    }

    private _onClose()
    {
        if(this.bLock_)
            return

        GameEventMgr.instance.addEvent(EventType.kRedPoint, null, { type: 1 })

        GameUserInfo.saveProp()
        GameUserInfo.saveSignIn()

        this.bLock_ = true
        this.closeTrans_.play(()=>{ this.reset() })
    }

    private _getAward()
    {
        this.bAwarded_ = true
        this.awardBtn_.grayed = true

        AudioMgr.instance.playSound(SfxType.kGoodClick)

        let info = GameUserInfo.signInAwards.getByIndex(GameUserInfo.dailyDat.signInAwardCnt) as BonusInfo
        let t = info.type
        if(t === BonusType.kCoin)
        {
            TipUI.instance.show('获得金币×' + info.count + '！')
        }
        else if(t >= BonusType.kBox1 && t <= BonusType.kBox3)
        {
            this.box_.show(t - BonusType.kBox1 + 1, this._boxOpened.bind(this))
        }
        else if(t >= BonusType.kPiece1 && t <= BonusType.kPiece3)
            TipUI.instance.show('获得碎片' + (t - BonusType.kPiece1 + 1) + '×' + info.count)

        this.items_[GameUserInfo.dailyDat.signInAwardCnt].maskGrp.visible = true

        // let date = new Date()
        // Player.signInDat.lastDay = date.getDate()
        
        GameUserInfo.dailyDat.signInAwarded = 1
        ++GameUserInfo.dailyDat.signInTotalCnt
        ++GameUserInfo.dailyDat.signInAwardCnt
        
        GameUserInfo.saveSignIn()
        GameUserInfo.saveProp()
    }

    private _boxOpened()
    {
        TipUI.instance.show('获得宝箱奖励！')

        GameUserInfo.saveProp()
    }
}
