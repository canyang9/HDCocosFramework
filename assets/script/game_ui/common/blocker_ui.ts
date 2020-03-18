
import  { BaseUI, UIHierarchy } from "./base_ui";
import { TimedTaskMgr } from "../../util/timed_task";

export class InputBlocker extends BaseUI {
    static instance = new InputBlocker

    private bg_: FGUIImage = null
    private rotTrans_: FGUITrans = null

    private taskId_ = 0

    init(com: FGUICom)
    {
        if(com)
        {
            this.com_ = com
            com.setSize(cc.view.getVisibleSize().width, cc.view.getVisibleSize().height)

            this.bg_ = com.getChild("bg").asImage
            this.rotTrans_ = com.getTransition('rot')

            com.sortingOrder = UIHierarchy.kBlocker
            com.visible = false
            BaseUI.root.addChild(com)
        }
    }

    block(time = 3, bShowBg = false)
    {
        if(this.com_)
        {
            this.com_.visible = true

            if(this.bg_)
            {
                this.bg_.visible = bShowBg       
            }

            this.rotTrans_.play(null, -1)

            if(this.taskId_ > 0)
            {
                TimedTaskMgr.instance.remove(this.taskId_)
                this.taskId_ = 0
            }

            this.taskId_ = TimedTaskMgr.instance.add(()=>{
                this.hide()

            }, time)
        }
    }

    hide()
    {
        if(this.com_)
        {
            if(this.taskId_ > 0)
            {
                TimedTaskMgr.instance.remove(this.taskId_)
                this.taskId_ = 0
            }

            this.rotTrans_.stop()

            this.com_.visible = false

            this.taskId_ = 0
        }
    }
}

export const InputBlockerInst = InputBlocker.instance