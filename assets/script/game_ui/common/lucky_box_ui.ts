
import { BaseUI } from "./base_ui";
import { HDMap } from "../../util/structure/hd_map";
import { GameUserInfo, BonusInfo, BonusType } from "../../game/user_info";
import { TimedTaskMgr } from "../../util/timed_task";
import { AudioMgr, SfxType } from "../../util/audio_mgr";
import { G } from "../../util/global_def";
import { HDVideoAd } from "../../util/ad_tools";

const kMaxItems = 3

export class LuckyBoxUI extends BaseUI {
    private awardBtn_: FGUIButton = null
    private doubleBtn_: FGUIButton = null

    private doubleCtrl_: FGUICtrl = null

    private openTrans_: FGUITrans = null
    private piece3Trans_: FGUITrans = null
    private piece2Trans_: FGUITrans = null
    private piece1Trans_: FGUITrans = null
    private closeTrans_: FGUITrans = null

    private itemGrps_: FGUIGroup[] = []
    private iconLoaders_: FGUILoader[] = []
    private itemTxts_: FGUITextField[] = []

    private awardMap_ = new HDMap() //key:award type value:award num
    private awardNum_ = 0

    private closeCallback_: Function = null

    private taskId_ = 0

    init(com: FGUICom)
    {
        if(com)
        {
            this.com_ = com

            // this.com_.setSize(cc.view.getVisibleSize().width, cc.view.getVisibleSize().height)

            this.awardBtn_ = com.getChild('awardBtn').asButton
            this.doubleBtn_ = com.getChild('doubleBtn').asButton

            this.doubleCtrl_ = this.doubleBtn_.getController('sh')

            this.openTrans_ = com.getTransition('openTrans')
            this.piece3Trans_ = com.getTransition('piece3Trans')
            this.piece2Trans_ = com.getTransition('piece2Trans')
            this.piece1Trans_ = com.getTransition('piece1Trans')
            this.closeTrans_ = com.getTransition('closeTrans')

            for(let i = 0; i < kMaxItems; ++i)
            {
                let sn = i + 1
                this.itemGrps_[i] = com.getChild('itemGrp' + sn).asGroup
                this.iconLoaders_[i] = com.getChild('iconLoader' + sn).asLoader
                this.itemTxts_[i] = com.getChild('itemTxt' + sn).asTextField
            }
        }
    }

    /**
     * 显示宝箱
     * @param rank 生成的宝箱品阶，1为最高 2为中等 3为最差
     * @param callback 打开宝箱后的回调
     */
    show(rank: number, callback?: Function)
    {
        if(this.com_)
        {
            this.com_.visible = true

            this.closeCallback_ = callback

            this.awardBtn_.onClick(this._onAward, this)
            this.doubleBtn_.onClick(this._onDouble, this)

            if(this.doubleCtrl_)
                this.doubleCtrl_.selectedIndex = GameUserInfo.isVideoLimited ? 1 : 0

            this._genAwards(rank)

            for(let i = 0; i < kMaxItems; ++i)
            {
                // this.itemGrps_[i].visible = false
                this.iconLoaders_[i].setScale(1, 1)
            }

            if(this.taskId_ > 0)
            {
                TimedTaskMgr.instance.remove(this.taskId_)

                this.taskId_ = 0
            }

            AudioMgr.instance.playSound(SfxType.kLuckyBox)

            this.openTrans_.play()
            this.taskId_ = TimedTaskMgr.instance.add(()=>{
                if(this.awardNum_ == 1)
                    this.piece1Trans_.play()
                else if(this.awardNum_ == 2)
                    this.piece2Trans_.play()
                else if(this.awardNum_ == 3)
                    this.piece3Trans_.play()
                
                AudioMgr.instance.playSound(SfxType.kGoodClick)

                this.bLock_ = false

            }, 2)

            this.bLock_ = true
        }
    }

    reset()
    {
        if(this.com_)
        {
            if(this.taskId_ > 0)
            {
                TimedTaskMgr.instance.remove(this.taskId_)

                this.taskId_ = 0
            }

            this.awardBtn_.offClick(this._onAward, this)
            this.doubleBtn_.offClick(this._onDouble, this)

            this.openTrans_.stop()
            this.piece3Trans_.stop()
            this.piece2Trans_.stop()
            this.piece1Trans_.stop()

            this.awardMap_.clear()

            this.closeTrans_.play(()=>{
                this.com_.visible = false

                if(this.closeCallback_)
                    this.closeCallback_()
            })
        }
    }

    //mul 奖励倍率
    private _onAward(mul = 1)
    {
        if(!this.bLock_)
        {
            this.awardMap_.each(this._awardTraverse.bind(this), mul)

            GameUserInfo.saveProp()

            this.reset()
        }
    }

    private _onDouble()
    {
        if(!this.bLock_)
        {
            if(G.isWeChat)
            {
                HDVideoAd.watchOrShare(HDVideoAd.kBox, this._onAward.bind(this), 2)

                if(this.doubleCtrl_)
                    this.doubleCtrl_.selectedIndex = GameUserInfo.isVideoLimited ? 1 : 0
            }
            else
                this._onAward(2)
        }
    }

    private _genAwards(rank: number)
    {
        if(rank == 0 || rank == 3)
        {
            this.awardNum_ = 1
        }
        else
        {
            this.awardNum_ = kMaxItems - rank + 1
        }

        this.awardNum_ = this.awardNum_ || 1

        if(this.awardMap_)
        {
            this.awardMap_.clear()
            GameUserInfo.genBoxAwards(this.awardNum_, this.awardMap_)

            this.awardMap_.each(this._initAwardIcons.bind(this))
        }
    }

    private _awardTraverse(i: number, sn: number, info: BonusInfo, mul: number)
    {
        let t = info.type
        if(t == BonusType.kCoin)
        {
            //样例代码，获取金币
            // CoinUI.instance.get(info.count * mul)
        }
        else if(t >= BonusType.kPiece1 && t <= BonusType.kPiece3)
        {
            //样例代码，获取碎片
            // let idx = t - BonusType.kPiece1 + 1
            // Player.addPiece(idx, info.count * mul)
        }

        if(this.itemTxts_[i])
        {
            this.itemTxts_[i].text = 'x' + info.count * mul
        }
    }

    private _initAwardIcons(i: number, sn: number, info: BonusInfo)
    {
        if(this.iconLoaders_[i])
        {
            let url = ''
            let t = info.type
            if(t === BonusType.kCoin)
                url = 'ui://CommUI/coin'
            else if(t >= BonusType.kPiece1 && t <= BonusType.kPiece3)
                url = 'ui://CommUI/piece' + (t - BonusType.kPiece1 + 1)

            this.iconLoaders_[i].url = url
        }

        if(this.itemTxts_[i])
        {
            this.itemTxts_[i].text = 'x' + info.count
        }
    }
}