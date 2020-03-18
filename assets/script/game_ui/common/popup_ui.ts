import { BaseUI } from "./base_ui";

export class PopupUI extends BaseUI {
    static instance = new PopupUI

    private lbl_: FGUITextField = null

    init(com: FGUICom)
    {
        if(com)
        {
            this.com_ = com

            this.lbl_ = com.getChild('txtLbl').asTextField
        }
    }

    show(txt: string)
    {
        if(this.com_)
        {
            this.lbl_.text = txt

            this.com_.setSize(this.lbl_.actualWidth + 20, this.lbl_.actualHeight + 20)

            fgui.GRoot.inst.showPopup(this.com_)
        }
    }
}

export const PopupUIInst = PopupUI.instance