import  { BaseUI, UIHierarchy } from "./base_ui";
import { AudioMgr } from "../../util/audio_mgr";
import { G } from "../../util/global_def";
import { TimedTaskMgr } from "../../util/timed_task";

const kTips = [
    '小心不要碰到礁石',
    '加速滑板能让你变得更快',
    '尽量避开障碍',
    '不要在背后撞到对手',
    '空中调整方向很困难',
    '冲刺状态下撞到障碍不会减速',
    '复活后能够无敌一小段时间'
]

export class TransUI extends BaseUI {
    static instance = new TransUI

    private lbl_: FGUITextField = null

    private loader_: FGUILoader = null

    private showTrans_: FGUITrans = null
    private closeTrans_: FGUITrans = null
    private rotTrans_: FGUITrans = null

    private callbackOver_: Function = null
    private taskId_ = 0

    private bTrans_ = false

    init(com: FGUICom)
    {
        if(com)
        {
            this.com_ = com
            com.setSize(cc.view.getVisibleSize().width, cc.view.getVisibleSize().height)

            this.lbl_ = com.getChild('txtLbl').asTextField

            this.loader_ = com.getChild('imgLoader').asLoader

            this.showTrans_ = com.getTransition("showTrans")
            this.closeTrans_ = com.getTransition('closeTrans')
            this.rotTrans_ = com.getTransition('rotTrans')

            com.sortingOrder = UIHierarchy.kTrans
            com.visible = false
            BaseUI.root.addChild(com)
        }
    }

    show(overCb: Function, bSkip = false)
    {
        if(this.com_)
        {
            this.com_.visible = true

            AudioMgr.instance.stopMusic()

            this.callbackOver_ = overCb

            if(bSkip)
            {
                this.loader_.visible = false
                this.lbl_.visible = false
            }
            else
            {
                this.loader_.visible = true
                this.lbl_.visible = true

                this.lbl_.text = kTips[G.randRange(0, kTips.length - 1)]

                if(this.taskId_ > 0)
                {
                    TimedTaskMgr.instance.remove(this.taskId_)
                    this.taskId_ = 0
                }
            }

            this.showTrans_.play(this._showOver.bind(this))
            this.rotTrans_.play(null, -1)

            this.bTrans_ = true
        }
    }

    over(delay = 0, overCb: Function = null)
    {
        if(this.bTrans_)
        {
            if(delay > 0)
            {
                this.taskId_ = TimedTaskMgr.instance.add(()=>{
                    if(overCb)
                        overCb()

                    this._close()
                }, delay)
            }
            else
            {
                if(overCb)
                    overCb()

                this._close()
            }
        }
        else
        {
            if(overCb)
                overCb()
        }
    }

    reset()
    {
        if(this.com_)
        {
            this.rotTrans_.stop()

            this.com_.visible = false

            this.bTrans_ = false
        }
    }

    private _showOver()
    {
        if(this.callbackOver_)
        {
            this.callbackOver_()
            this.callbackOver_ = null
        }
    }

    private _close()
    {
        this.closeTrans_.play(this.reset.bind(this))
    }
}

export const TransUIInst = TransUI.instance