import { BaseUI } from "./base_ui";

const {ccclass, property} = cc._decorator;

@ccclass
export class FGUIRoot extends cc.Component {
    public static instance: FGUIRoot = null

    public static nativePath = 'fgui/'

    onLoad()
    {
        FGUIRoot.instance = this

        fgui.addLoadHandler();
        fgui.GRoot.create();

        BaseUI.root = fgui.GRoot.inst

        cc.game.addPersistRootNode(BaseUI.root.node)
    }

    start()
    {
        // cc.loader.loadResArray([
        //     FGUIRoot.nativePath + "CommUI_atlas0",
        //     FGUIRoot.nativePath + "CommUI" 
        // ], this._onLoadCommUI.bind(this))

        
    }
}
