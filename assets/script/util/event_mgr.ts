import { HDMap } from "./structure/hd_map";
import { G } from "./global_def";

//全局事件处理器

//事件类型定义，请自行定义
export enum EventType {
    kNone,
    //-------预留字段，请勿删除--------
    kAudioPause, //音频暂停
    kAudioResume, //音频恢复

    kBnrAdBrowerSim, //本地浏览器banner广告模拟

    kAdjustVfxLv, //调节特效等级
    //----------------------

    kOpenFreeBox, //开启免费箱子
    kLeaveHome, //离开主页
    kRedPoint, //小红点
}

//单个事件的定义，该类会由管理器自行创建，无需手动控制
class GameEvent {
    private type_ = EventType.kNone
    private id_ = 0
    private sender_: object = null
    private data_: object = null

    public init(id: number, t: EventType, sender: object, data: object)
    {
        this.id_ = id
        this.type_ = t
        this.sender_ = sender
        this.data_ = data
    }

    public get type(): EventType
    {
        return this.type_
    }

    public get id(): number
    {
        return this.id_
    }

    public get sender(): object
    {
        return this.sender_
    }

    public get data(): object
    {
        return this.data_
    }
}

//事件监听器，由各个监听模块自行定义监听以及监听处理，由管理器生成，但是id号由用户管理（用于移除侦听）
class GameListener {
    private id_ = 0
    private callback_: Function = null

    bExe = false

    public get id()
    {
        return this.id_
    }

    public init(id: number, cb: Function)
    {
        this.id_ = id
        this.callback_ = cb
    }

    public excute(sender: object, data: any)
    {
        this.bExe = true

        if(this.callback_)
            this.callback_(sender, data)

        this.bExe = false
    }
}

//事件管理器，事件相关的操作都通过此类的方法进行
export class GameEventMgr {
    static instance: GameEventMgr = new GameEventMgr()

    private constructor() {}

    private baseEvtId_ = 0
    private baseListenerId_ = 0

    private listenerMap_: HDMap = null
    private persistListnerMap_: HDMap = null

    private delMap_: HDMap = new HDMap()

    private evtLst_: Array<GameEvent> = null

    private bExe_ = false

    //初始化事件管理器，框架中已经在GameLogic初始化时一并调用，可以不用手动调用
    public init()
    {
        this.baseEvtId_ = 0
        this.baseListenerId_ = 0

        if(this.listenerMap_ == null)
            this.listenerMap_ = new HDMap()

        this.listenerMap_.clear()

        if(this.persistListnerMap_ == null)
            this.persistListnerMap_ = new HDMap()

        this.persistListnerMap_.clear()

        if(this.evtLst_ == null)
            this.evtLst_ = new Array()
        
        this.evtLst_ = []

        this.bExe_ = false
    }

    //添加一个指定的事件
    /**
     * 
     * @param t 事件类型，由用户自己定义
     * @param sender 事件发起者，由用户自行考虑是否传入，通常用于监听逻辑
     * @param data 事件携带数据，由用户自行定义格式，用于在发起者与监听者之间传递必要信息
     * @param bImmediately 是否立即执行，默认为false，将会在每帧统一执行，可能影响某些执行顺序，置为true则是监听者立即执行相应的逻辑
     * 
        GameEventMgr.instance.addEvent(EventType.kLoadOver, null, { bLoad: true }, true)
     */
    public addEvent(t: EventType, sender: object = null, data: any = null, bImmediately = true)
    {
        ++this.baseEvtId_

        let evt = new GameEvent()
        evt.init(this.baseEvtId_, t, sender, data)

        if(bImmediately)
        {
            let lst = this.listenerMap_.get(t)
            if(lst != null)
            {
                for(let i = 0; i < lst.length; ++i)
                    lst[i].excute(evt.sender, evt.data)
            }
        }
        else
        {
            this.bExe_ = true
            this.evtLst_.push(evt)
        }
    }

    //添加一个侦听器，侦听器初始化用的回调可以包含两个参数，参数1是sender，参数2是data，分别对应事件的发起者和携带的数据
    /**
     * 
     * @param t 侦听的事件类型
     * @param cb 侦听器回调函数
     * @param bPersist 是否为常驻监听器，标记为常驻的监听器不会被clear清除，但可以被remove指定移除
     * @returns 返回一个侦听器全局唯一id
     * 
        GameEventMgr.instance.addListener(EventType.kLoadOver, function(sender, data) { //dosomething })
     */
    public addListener(t: EventType, cb: Function, bPersist = false): number
    {   
        ++this.baseListenerId_

        let lis = new GameListener()
        lis.init(this.baseListenerId_, cb)

        let lst = null
        if(this.listenerMap_.containsKey(t))
        {
            lst = this.listenerMap_.get(t)
            if(lst != null)
                lst.push(lis)
        }
        else
        {
            lst = new Array()
            lst.push(lis)
            this.listenerMap_.put(t, lst)
        }

        if(bPersist && lst)
        {
            this.persistListnerMap_.put(t, lst)
        }

        return this.baseListenerId_
    }

    //移除指定的侦听器
    /**
     * 
     * @param t 侦听的事件类型
     * @param id 要移除的事件id
     * 
        let id = GameEventMgr.instance.addListener(EventType.kLoadOver, null)
        //..........
        GameEventMgr.instance.removeListener(EventType.kLoadOver, id)
     */
    public removeListener(t: EventType, id: number)
    {
        if(this.listenerMap_.containsKey(t))
        {
            let lst = this.listenerMap_.get(t)
            if(lst != null)
            {
                for(let i = 0; i < lst.length; ++i)
                {
                    if(!lst[i].bExe && lst[i].id === id)
                    {
                        lst.splice(i, 1)
                        break
                    }
                    else if(lst[i].bExe)
                    {
                        this.delMap_.put(t, id)
                        this.bExe_ = true
                    }
                }

                if(lst.length == 0)
                {
                    this.listenerMap_.remove(t)
                    if(this.persistListnerMap_.containsKey(t))
                        this.persistListnerMap_.remove(t)
                }
            }
        }
    }

    //清空所有事件监听和队列，建议跳转场景前进行清理，框架中已经在GameLogic的changeScene中调用
    public clear()
    {
        this.evtLst_ = []

        let delArr = []
        this.listenerMap_.each((i, k, v)=>{
            if(!this.persistListnerMap_.containsKey(k))
                delArr.push(k)
        })

        for(let i = 0; i < delArr.length; ++i)
            this.listenerMap_.remove(delArr[i])

        this.delMap_.clear()
    }

    //每帧处理事件队列，在框架中已经在GameLogic的update中调用，无需手动调用
    public excuteEvents()
    {
        if(!this.bExe_)
            return

        for(let i = 0; i < this.evtLst_.length; ++i)
        {
            let evt = this.evtLst_[i]
            if(evt == null)
            {
                G.log('can not find the approriate game event', 3)
                break
            }

            let lst = this.listenerMap_.get(evt.type)
            if(lst)
            {
                for(let j = 0; j < lst.length; ++j)
                {
                    lst[j].excute(evt.sender, evt.data)
                }
            }
            else
                G.log('Can not find the listeners about event ', 2, evt.type.toString())
        }

        if(this.delMap_.size() > 0)
        {
            this.delMap_.each((i, k, v)=>{
                this.removeListener(k, v)
            })

            this.delMap_.clear()
        }

        this.evtLst_ = []
        this.bExe_ = false
    }
}

export const GameEventMgrInst = GameEventMgr.instance