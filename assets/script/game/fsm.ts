import { HDMap } from "../util/structure/hd_map";

export enum FSMState {
    kNone,
    kIdle,
}

class BaseState {
    protected obj_: any = null //状态所绑定的对象，类型由用户自行定义

    protected param_: any = null

    protected state_ = FSMState.kNone

    constructor(obj: any, st: FSMState)
    {
        this.obj_ = obj

        this.state_ = st
    }

    get state()
    {
        return this.state_
    }

    enter(param: any) {}

    update(dt) {}

    over() {}
}

//样例，继承基础状态实现相应的函数
class IdelState extends BaseState {
    enter(param: any)
    {
        if(this.obj_)
        {
            
        }
    }
}

export class FSMController {
    private stateMap_ = new HDMap()

    private currState_: BaseState = null

    constructor(obj: any)
    {
        this.stateMap_.put(FSMState.kIdle, new IdelState(obj, FSMState.kIdle))
        //......add states here
    }

    switch(state: FSMState, param: any = null)
    {
        if(this.currState_)
            this.currState_.over()

        if(this.stateMap_.containsKey(state))
        {
            this.currState_ = this.stateMap_.get(state)
            this.currState_.enter(param)
        }
    }

    currState()
    {
        return this.currState_ ? this.currState_.state : FSMState.kNone
    }

    update(dt)
    {
        if(this.currState_)
            this.currState_.update(dt)
    }
}
