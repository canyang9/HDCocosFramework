import { HDMap } from "./structure/hd_map";

export enum TimedTaskType {
    kNone,
}

export const kInfinitedRepeat = -2

class TTask {
    id = 0
    type = TimedTaskType.kNone

    private callback_ = null
    private param_ = null

    private timer_ = 0

    private repeat_ = 1
    private delay_ = 0
    private interval_ = 0

    private bFrame_ = false

    private bPause_ = false

    set pause(val: boolean)
    {
        this.bPause_ = this.bPause_
    }

    init(id: number, cb: Function, delay = 0, repeat = 1, interval = 0, param = null, 
        type = TimedTaskType.kNone, bFrame = false)
    {
        this.id = id

        this.callback_ = cb

        this.repeat_ = repeat < kInfinitedRepeat ? kInfinitedRepeat : repeat
        this.delay_ = delay
        this.interval_ = interval

        this.timer_ = interval

        this.type = type

        this.bFrame_ = bFrame

        this.bPause_ = false
    }

    excute(dt)
    {
        if(this.bPause_)
            return

        let bRet = false

        if(this.delay_ > 0)
        {
            if(this.bFrame_)
                --this.delay_
            else
                this.delay_ -= dt

            return
        }

        if(this.repeat_ > 0 || this.repeat_ === kInfinitedRepeat)
        {
            if(this.bFrame_)
                ++this.timer_
            else
                this.timer_ += dt

            if(this.timer_ >= this.interval_)
            {
                if(this.repeat_ > 0)
                    --this.repeat_

                if(this.callback_)
                {
                    // console.log('excuteTasks callback', this.id)
                    this.callback_(this.param_)
                }

                this.timer_ = 0
            }
        }
        else if(this.repeat_ === 0)
        {
            bRet = true
        }

        return bRet
    }
}

export class TimedTaskMgr {
    static instance = new TimedTaskMgr()
    
    private baseId_ = 0

    private noneTypeMap_ = new HDMap()
    private specTypeMap_ = new HDMap()

    /**
     * 添加定时任务
     * @param cb 定时任务回调
     * @param delay 延时执行，仅第一次执行回调前生效，后续即使有重复也只以interval为准，
     * 当bFrame为true时，单位为帧，bFrame为false时，单位为s
     * @param repeat 定时任务执行次数，默认为1次，代表只执行一次回调，kInfinitedRepeat=-2为无限循环
     * @param interval 执行间隔，当repeat大于1时，每次执行回调之间的间隔时间，
     * 当bFrame为true时，单位为帧，bFrame为false时，单位为s
     * @param param 回调函数传入参数，由用户自行定义类型
     * @param type 定时任务自定义类型，用于批量对定时任务进行操作
     * @param bFrame 按帧计时还是按s计时
     * @returns 返回值为定时器id，用于用户自行管理定时器的删除与中途操作
     */
    add(cb: Function, delay = 0, repeat = 1, interval = 0, param = null,
        type = TimedTaskType.kNone, bFrame = false)
    {
        ++this.baseId_

        let t = new TTask()
        t.init(this.baseId_, cb, delay, repeat, interval, param, type, bFrame)

        if(type === TimedTaskType.kNone)
        {
            this.noneTypeMap_.put(this.baseId_, t)
        }
        else
        {
            if(this.specTypeMap_.containsKey(t))
            {
                let lst = this.specTypeMap_.get(t)
                if(lst != null)
                    lst.push(t)
            }
            else
            {
                let lst = new Array()
                lst.push(t)
                this.specTypeMap_.put(t, lst)
            }
        }

        return this.baseId_
    }

    addWithFrame(cb: Function, delay = 0, repeat = 1, interval = 0, param = null,
        type = TimedTaskType.kNone)
    {
        this.add(cb, delay, repeat, interval, param, type, true)
    }

    /**
     * 暂停一个指定id的定时任务
     * @param bPause 是否暂停
     * @param id 需要暂停的定时任务id
     * @param t 定时任务的类别，默认为无分类
     */
    pause(bPause: boolean, id: number, t = TimedTaskType.kNone)
    {
        if(t === TimedTaskType.kNone)
        {
            if(this.noneTypeMap_.containsKey(id))
                this.noneTypeMap_.get(id).pause = bPause
            else
                console.warn('[TimedTask] not valid id in type <TimedTaskType.kNone>')
        }
        else
        {
            if(this.specTypeMap_.containsKey(t))
            {
                if(id === -1)
                {
                    let lst = this.specTypeMap_.get(t)
                    if(lst)
                    {
                        for(let i = 0; i < lst.length; ++i)
                        {
                            lst[i].pause = bPause
                        }
                    }
                }
                else
                {
                    let lst = this.specTypeMap_.get(t)
                    if(lst != null)
                    {
                        for(let i = 0; i < lst.length; ++i)
                        {
                            if(lst[i].id === id)
                            {
                                lst[i].pause = bPause
                                break
                            }
                        }
                    }
                }
            }
            else
            {
                console.warn('[TimedTask] not valid type: ', t)
            }
        }
    }

    /**
     * 暂时除了排除列表中的所有定时任务
     * @param bPause 是否暂停
     * @param excludeIds 排除id列表，位于此列表中对应的id项不会被影响
     */
    pauseAll(bPause: boolean, excludeIds?: number[])
    {
        this.noneTypeMap_.each((i, k, v: TTask)=>{
            if(excludeIds)
            {
                let bExclude = false
                for(let j = 0; j < excludeIds.length; ++j)
                {
                    if(excludeIds[j] == v.id)
                    {
                        excludeIds.splice(j, 1)
                        bExclude = true
                        break
                    }
                }

                if(!bExclude)
                    v.pause = bPause
            }
            else
                v.pause = bPause
        })

        this.specTypeMap_.each((i, k, v)=>{
            if(excludeIds)
            {
                for(let i = 0; i < v.length; ++i)
                {
                    let bExclude = false
                    for(let j = 0; j < excludeIds.length; ++j)
                    {
                        if(excludeIds[j] == v[i].id)
                        {
                            excludeIds.splice(j, 1)
                            bExclude = true
                            break
                        }
                    }

                    if(!bExclude)
                        v[i].pause = bPause
                }
            }
            else
            {
                for(let i = 0; i < v.length; ++i)
                {
                    v[i].pause = bPause
                }
            }
        })
    }

    /**
     * 移除定时任务
     * @param id 要移除的定时任务id，当id为-1，且t不为TimedTaskType.kNone时，批量移除指定类型的定时任务
     * @param t 定时任务类型，需要用户自行定义
     */
    remove(id: number, t = TimedTaskType.kNone)
    {
        if(t === TimedTaskType.kNone)
        {
            if(this.noneTypeMap_.containsKey(id))
                this.noneTypeMap_.remove(id)
            // else
            //     console.warn('[TimedTask] not valid id in type <TimedTaskType.kNone>')
        }
        else
        {
            if(this.specTypeMap_.containsKey(t))
            {
                if(id === -1)
                {
                    this.specTypeMap_.remove(t)
                }
                else
                {
                    let lst = this.specTypeMap_.get(t)
                    if(lst != null)
                    {
                        for(let i = 0; i < lst.length; ++i)
                        {
                            if(lst[i].id === id)
                            {
                                lst.splice(i, 1)
                                break
                            }
                        }

                        if(lst.length == 0)
                            this.specTypeMap_.remove(t)
                    }
                }
            }
            else
            {
                console.warn('[TimedTask] not valid type: ', t)
            }
        }
    }

    clear()
    {
        this.baseId_ = 0

        this.noneTypeMap_.clear()
        this.specTypeMap_.clear()
    }

    excuteTasks(dt)
    {
        if(this.noneTypeMap_.size() > 0)
        {
            let delArr = []
            this.noneTypeMap_.each((i, k: number, v: TTask)=>{
                if(v.excute(dt))
                {
                    delArr.push(v.id)
                }
            })

            for(let i = 0; i < delArr.length; ++i)
            {
                this.remove(delArr[i])
            }
        }

        if(this.specTypeMap_.size() > 0)
        {
            let tArr = []
            let delArr = []
            this.specTypeMap_.each((i, k: TimedTaskType, lst: TTask[])=>{
                if(lst)
                {
                    tArr.push(k)
                    for(let j = 0; j < lst.length; ++j)
                    {
                        if(lst[j].excute(dt))
                            delArr.push(lst[j].id)
                    }
                }
            })

            for(let i = 0; i < tArr.length; ++i)
            {
                for(let j = 0; j < delArr.length; ++j)
                {
                    this.remove(delArr[j], tArr[i])
                }
            }
        }
    }
}

export const TimedTaskInst = TimedTaskMgr.instance