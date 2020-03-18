import  { BaseUI, UIHierarchy } from "./base_ui";
import { G } from "../../util/global_def";

export class DialogUI extends BaseUI {
    static instance = new DialogUI

    private titleLbl_: FGUITextField = null
    private contentLbl_: FGUITextField = null

    private confirmBtn_: FGUIButton = null
    private closeBtn_: FGUIButton = null

    private showTrans_: FGUITrans = null
    private closeTrans_: FGUITrans = null

    private yesCallback_: Function = null
    private noCallback_: Function = null

    init(com: FGUICom)
    {
        if(com)
        {
            this.com_ = com
            com.setSize(cc.view.getVisibleSize().width, cc.view.getVisibleSize().height)

            this.titleLbl_ = com.getChild('titleLbl').asTextField
            this.contentLbl_ = com.getChild('contentLbl').asTextField

            this.confirmBtn_ = com.getChild('confirmBtn').asButton
            this.closeBtn_ = com.getChild('closeBtn').asButton

            this.showTrans_ = com.getTransition("showTrans")
            this.closeTrans_ = com.getTransition('closeTrans')

            com.sortingOrder = UIHierarchy.kDialog
            com.visible = false
            BaseUI.root.addChild(com)
        }
    }

    /**
     * 展示组件
     * @param title 标题 
     * @param text 正文
     * @param yesCb 确定按钮点击回调
     * @param noCb 关闭按钮点击回调
     * @param bSingleBtn 只显示单个按钮，默认显示两个
     */
    show(title: string, text: string, yesCb?: Function, noCb?: Function, bSingleBtn = false)
    {
        if(this.com_)
        {
            this.com_.visible = true

            this.titleLbl_.text = title
            this.contentLbl_.text = text

            this.bLock_ = true
            this.showTrans_.play(()=>{ this.bLock_ = false })

            this.confirmBtn_.onClick(this._onConfirm, this)
            this.closeBtn_.onClick(this._onClose, this)

            this.yesCallback_ = yesCb
            this.noCallback_ = noCb

            if(bSingleBtn)
                this.closeBtn_.visible = false
            else
                this.closeBtn_.visible = true
        }
    }

    reset()
    {
        if(this.com_)
        {
            this.bLock_ = false

            this.com_.visible = false

            this.confirmBtn_.offClick(this._onConfirm, this)
            this.closeBtn_.offClick(this._onClose, this)

            if(this.com_.sortingOrder != UIHierarchy.kDialog)
                this.renderSortOriginal()
        }
    }

    /** 临时将渲染层级提升到高层，与Tip同层，在关闭后会自动恢复，一般用于模拟调试 */
    renderSortTop()
    {
        if(this.com_)
            this.com_.sortingOrder = UIHierarchy.kTip
    }

    /** 将渲染层级恢复到原始值 */
    renderSortOriginal()
    {
        if(this.com_)
            this.com_.sortingOrder = UIHierarchy.kDialog
    }

    private _onConfirm()
    {
        if(this.bLock_)
            return

        if(this.yesCallback_)
            this.yesCallback_()

        this.bLock_ = true
        this.closeTrans_.play(this.reset.bind(this))
    }

    private _onClose()
    {
        if(this.bLock_)
            return

        if(this.noCallback_)
            this.noCallback_()

        this.bLock_ = true
        this.closeTrans_.play(this.reset.bind(this))
    }
}

export const DialogUIInst = DialogUI.instance 