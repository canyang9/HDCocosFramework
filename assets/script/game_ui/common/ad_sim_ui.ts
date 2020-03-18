import { HDMap } from "../../util/structure/hd_map";
import { DataHub } from "../../data/data_hub";
import { UIHierarchy, BaseUI } from "./base_ui";

export class BannerSimUI {
    private static testBnrMap_ = new HDMap() //key: adunitId value: FGUICom
    private static lastTestBnrStack_: FGUICom[] = []
    
    //----------------------本地模拟banner展示用，无需关注-----------------------------
    static addTestBannerHolder(id: string, node?: FGUICom, posType = 1)
    {
        if(!this.testBnrMap_.containsKey(id))
        {
            let c = fgui.UIPackage.createObject('CommUI', 'BnrTestHolder') as FGUICom
            if(c)
            {
                if(node)
                    c.setPosition(0, node.localToGlobal().y + DataHub.config.bnrGap)
                else
                {
                    if(posType === 1)
                        c.setPosition(0, cc.view.getVisibleSize().height - c.height)
                    else
                        c.setPosition(0, 0)
                }

                c.visible = false

                let lbl = c.getChild('txt') as FGUICom
                if(lbl)
                {
                    lbl = lbl as FGUILabel
                    lbl.text = id
                }

                c.sortingOrder = UIHierarchy.kTestBnr
                BaseUI.root.addChild(c)

                this.testBnrMap_.put(id, c)
            }
        }
    }

    static isTestBannerHolderShowed(id: string)
    {
        let bRet = false

        if(this.testBnrMap_.containsKey(id))
        {
            let com = this.testBnrMap_.get(id)
            bRet = com.visible
        }

        return bRet
    }

    static isTestBannerLimited(id: string)
    {
        //自行修改返回值测试广告受限时的情况
    }

    static showTestBannerHolder(id: string)
    {
        this.hideLastTestBanner()

        if(this.testBnrMap_.containsKey(id))
        {
            let com = this.testBnrMap_.get(id)
            com.visible = true

            this.lastTestBnrStack_.push(com) 
        }
    }

    static hideTestBannerHolder(id: string)
    {
        if(this.testBnrMap_.containsKey(id))
        {
            this.testBnrMap_.get(id).visible = false

            this.lastTestBnrStack_.pop()

            if(this.lastTestBnrStack_.length > 0)
                this.lastTestBnrStack_[this.lastTestBnrStack_.length - 1].visible = true
        }
    }

    static showLastTestBanner()
    {
        if(this.lastTestBnrStack_.length > 0)
            this.lastTestBnrStack_[this.lastTestBnrStack_.length - 1].visible = true
    }

    static hideLastTestBanner()
    {
        if(this.lastTestBnrStack_.length > 0)
            this.lastTestBnrStack_[this.lastTestBnrStack_.length - 1].visible = false
    }

    static hideAllTestBanner()
    {
        this.hideLastTestBanner()

        this.testBnrMap_.each((i, k, v)=>{
            this.hideTestBannerHolder(k)
        })
    }
    //----------------------本地模拟banner展示用，无需关注-----------------------------
}