
export enum UIHierarchy {
    kDefault,
    //---自定义层级，高的渲染在画面前面---
    kSetting = 994,
    kDialog = 995,
    kCoin = 996,
    kBlocker = 997,
    kTrans = 998,
    kExportCom = 999,
    kExportPage = 1000,
    kTip = 1001,
    kTestBnr = 1002
    //---------------------------------
}

export class BaseUI {
    static root: fgui.GRoot = null

    protected com_: FGUICom = null
    
    protected id_ = 0
    protected bLock_ = false

    init(com: FGUICom)
    {
        
    }

    add(parent: FGUICom)
    {
        if(this.com_)
        {
            parent.addChild(this.com_)

            this.com_.visible = false
        }
    }

    reset()
    {
        
    }

    remove()
    {
        if(this.com_)
        {
            this.com_.removeFromParent()
        }
    }
}