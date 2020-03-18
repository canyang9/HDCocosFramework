import { BaseUI, UIHierarchy } from "./base_ui";
import { TipUI } from "./tip_ui";
import { AudioMgr } from "../../util/audio_mgr";
import { GameEventMgr, EventType } from "../../util/event_mgr";
import { GameStorage, SaveDef } from "../../util/game_storage";

export enum VFXLevel {
    kLow = 1,
    kMid,
    kHigh
}

enum ToggleType {
    kBgm,
    kSfx,
    kHighFx,
    kMidFx,
    kLowFx
}

export class SettingUI extends BaseUI {
    static instance = new SettingUI()

    private bgmToggle_: FGUIButton = null
    private sfxToggle_: FGUIButton = null
    private highFxRadio_: FGUIButton = null
    private midFxRadio_: FGUIButton = null
    private lowFxRadio_: FGUIButton = null
    private backBtn_: FGUIButton = null
    private homeBtn_: FGUIButton = null

    private openTrans_: FGUITrans = null
    private closeTrans_: FGUITrans = null

    private closeCb_: Function = null

    private vfxLv_ = VFXLevel.kMid //3高 2中 1低
    private bVfx_ = false

    private bGame_ = false

    get VFXLvl()
    {
        return this.vfxLv_
    }

    set VFXLvl(val: number)
    {
        this.vfxLv_ = val

        this._save()
    }

    init(com: FGUICom)
    {
        if(com)
        {
            this.com_ = com
            com.setSize(cc.view.getVisibleSize().width, cc.view.getVisibleSize().height)

            this.bgmToggle_ = com.getChild('bgmToggle').asButton
            this.sfxToggle_ = com.getChild('sfxToggle').asButton
            this.highFxRadio_ = com.getChild('fxHighRadio').asButton
            this.midFxRadio_ = com.getChild('fxMidRadio').asButton
            this.lowFxRadio_ = com.getChild('fxLowRadio').asButton
            this.backBtn_ = com.getChild('backBtn').asButton
            this.homeBtn_ = com.getChild('homeBtn').asButton

            this.openTrans_ = com.getTransition('openTrans')
            this.closeTrans_ = com.getTransition('closeTrans')

            this.bgmToggle_.selected = !AudioMgr.instance.isStopMusic()
            this.sfxToggle_.selected = !AudioMgr.instance.isStopSound()

            fgui.GRoot.inst.volumeScale = this.sfxToggle_.selected ? 1 : 0

            this._read()

            this.bgmToggle_.on(fgui.Event.STATUS_CHANGED, this._onToggleChange, this)
            this.sfxToggle_.on(fgui.Event.STATUS_CHANGED, this._onToggleChange, this)
            this.highFxRadio_.on(fgui.Event.STATUS_CHANGED, this._onToggleChange, this)
            this.midFxRadio_.on(fgui.Event.STATUS_CHANGED, this._onToggleChange, this)
            this.lowFxRadio_.on(fgui.Event.STATUS_CHANGED, this._onToggleChange, this)
                
            this.backBtn_.onClick(this._onClose, this)
            this.homeBtn_.onClick(this._onHome, this)

            com.sortingOrder = UIHierarchy.kSetting
            com.visible = false
            BaseUI.root.addChild(com)
        }
    }

    //bGame 一般游戏过程中会暂停游戏逻辑，默认为非游戏过程
    show(openCb?: Function, closeCb?: Function, bGame = false)
    {
        if(this.com_)
        {
            this.com_.visible = true

            this.bVfx_ = false

            this.homeBtn_.visible = bGame

            this.bLock_ = true
            this.openTrans_.play(()=>{ 
                this.bLock_ = false

                if(openCb)
                {
                    openCb()
                }

            })
            let ctrl = this.com_.getController('FxRadioGroup')
            if(this.vfxLv_ === 3)
                ctrl.selectedIndex = 0
            else if(this.vfxLv_ === 2)
                ctrl.selectedIndex = 1
            else if(this.vfxLv_ === 1)
                ctrl.selectedIndex = 2

            this.bGame_ = bGame

            this.closeCb_ = closeCb
        }
    }

    private _onToggleChange(evt: cc.Event)
    {
        if(this.bLock_)
            return

        let n = evt as any
        if(n == this.bgmToggle_) 
        {
            AudioMgr.instance.setIfMuteMusic(!this.bgmToggle_.selected)
        }
        else if(n == this.sfxToggle_)
        {
            AudioMgr.instance.setIfMuteSound(!this.sfxToggle_.selected)
            fgui.GRoot.inst.volumeScale = this.sfxToggle_.selected ? 1 : 0
        }
        else if(n == this.highFxRadio_)
        {
            this.vfxLv_ = VFXLevel.kHigh
            this.bVfx_ = true
        }
        else if(n == this.midFxRadio_)
        {
            this.vfxLv_ = VFXLevel.kMid
            this.bVfx_ = true
        }
        else if(n == this.lowFxRadio_)
        {
            this.vfxLv_ = VFXLevel.kLow
            this.bVfx_ = true
        }
    }

    private _onClose()
    {
        if(this.bLock_)
            return

        if(this.com_)
        {
            this._save()

            if(this.closeCb_)
                this.closeCb_()

            GameEventMgr.instance.addEvent(EventType.kAdjustVfxLv, null, { lv: this.vfxLv_ })

            if(!this.bGame_)
            {
                this.closeTrans_.play(()=>{
                    this.com_.visible = false
                })
            }
            else
            {
                if(this.bVfx_)
                    TipUI.instance.show('游戏中仅部分特效设置生效')
                    
                this.com_.visible = false
            }
        }
    }

    private _onHome()
    {
        if(this.bLock_)
            return

        this._onClose()

        // TransUI.instance.show(()=>{ GameEventMgr.instance.addEvent(EventType.kBackHome) }, true)
    }

    private _save()
    {
        let sav = {
            effLv: this.vfxLv_
        }
        GameStorage.writeJSON(SaveDef.kSetting, sav)
    }

    private _read()
    {
        let sav = GameStorage.readJSON(SaveDef.kSetting)
        if(sav)
        {
            this.vfxLv_ = sav.effLv
        }
        else
            this.vfxLv_ = VFXLevel.kMid
    }
}

export const SettingUIInst = SettingUI.instance