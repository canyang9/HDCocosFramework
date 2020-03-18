import  { BaseUI, UIHierarchy } from "./base_ui";
import { G } from "../../util/global_def";

export class TipUI extends BaseUI {
    static instance = new TipUI

    private lbl_: FGUITextField = null

    private showTrans_: FGUITrans = null

    init(com: FGUICom)
    {
        if(com)
        {
            this.com_ = com
            com.setSize(cc.view.getVisibleSize().width, cc.view.getVisibleSize().height)

            this.lbl_ = com.getChild('tipLbl').asTextField

            this.showTrans_ = com.getTransition("showTrans")

            com.sortingOrder = UIHierarchy.kTip
            com.visible = false
            BaseUI.root.addChild(com)
        }
    }

    show(txt: string)
    {
        if(this.com_)
        {
            this.com_.visible = true

            this.lbl_.text = txt

            this.showTrans_.stop()
            this.showTrans_.play(()=>{ this.com_.visible = false })
        }
    }
}

export const TipUIInst = TipUI.instance