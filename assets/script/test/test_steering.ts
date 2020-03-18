
import { G } from "../util/global_def";
import { HDMap } from "../util/structure/hd_map";
import { SteeringVehicleBase } from "../util/algorithm/steering_vehicle";
import { GameLogic } from "../game_logic";

const {ccclass, property} = cc._decorator;

const kBehavior = [
    "寻找",
    "躲避",
    "到达",
    "追击与逃离",
    "漫游",
    "回避",
    "路径巡逻",
    "群落"
]

@ccclass
export class TestSteering extends cc.Component {
    @property(cc.Node)
    private vehicle1_: cc.Node = null

    @property(cc.Node)
    private vehicle2_: cc.Node = null

    @property(cc.Node)
    private vehicle3_: cc.Node = null

    @property(cc.Node)
    private targetCpy_: cc.Node = null 

    @property(cc.Label)
    private lbl_: cc.Label = null

    private targetPool_: cc.NodePool = null

    private targets_: HDMap = null

    private path_: cc.Vec2[] = []

    private group_: SteeringVehicleBase[] = []

    private target_: cc.Node = null

    private behaviorIdx_ = 0

    onLoad()
    {
        this.targetPool_ = new cc.NodePool()
        for(let i = 0; i < 5; ++i)
        {
            let n = cc.instantiate(this.targetCpy_)
            this.targetPool_.put(n)
        }

        this.targetCpy_.destroy()

        this.targets_ = new HDMap()

        this.group_.push(this.vehicle1_.getComponent('steering_vehicle'))
        this.group_.push(this.vehicle2_.getComponent('steering_vehicle'))
        this.group_.push(this.vehicle3_.getComponent('steering_vehicle'))

        this.lbl_.string = kBehavior[this.behaviorIdx_]

        this.node.on(cc.Node.EventType.TOUCH_START, this._touchBegin, this)
    }

    onDestroy()
    {
        this.targetPool_.clear()
    }

    private _touchBegin(evt: cc.Event.EventTouch)
    {
        let tPos = evt.touch.getLocationInView()

        let p = this.node.convertToNodeSpaceAR(tPos)
        let pos = cc.v2(p.x, this.node.height - p.y)

        if(this.targetPool_.size() > 0)
        {
            let n = this.targetPool_.get()
            n.position = pos

            this.node.addChild(n)

            this.targets_.put(n.uuid, n)

            this.target_ = this.targets_.get(n.uuid)

            this.path_.push(pos)
        }

        // cc.log('touch', tPos, pos)
    }

    update()
    {
        let bClear = true
        if(this.behaviorIdx_ === 0)
        {
            if(this.target_)
            {
                this.vehicle1_.getComponent('steering_vehicle').seek(this.target_.position)
                this.vehicle2_.getComponent('steering_vehicle').seek(this.target_.position)
                this.vehicle3_.getComponent('steering_vehicle').seek(this.target_.position)
            }
        }
        else if(this.behaviorIdx_ === 1)
        {
            if(this.target_)
                this.vehicle1_.getComponent('steering_vehicle').seek(this.target_.position)

            this.vehicle2_.getComponent('steering_vehicle').flee(this.vehicle1_.position)
            this.vehicle3_.getComponent('steering_vehicle').flee(this.vehicle1_.position)
        }
        else if(this.behaviorIdx_ === 2)
        {
            if(this.target_)
            {
                this.vehicle1_.getComponent('steering_vehicle').arrive(this.target_.position)
                this.vehicle2_.getComponent('steering_vehicle').arrive(this.target_.position)
                this.vehicle3_.getComponent('steering_vehicle').arrive(this.target_.position)
            }
        }
        else if(this.behaviorIdx_ === 3)
        {
            this.vehicle1_.getComponent('steering_vehicle').pursue(this.vehicle2_.getComponent('steering_vehicle'))
            this.vehicle2_.getComponent('steering_vehicle').pursue(this.vehicle3_.getComponent('steering_vehicle'))
            this.vehicle3_.getComponent('steering_vehicle').pursue(this.vehicle1_.getComponent('steering_vehicle'))

            this.vehicle1_.getComponent('steering_vehicle').evade(this.vehicle3_.getComponent('steering_vehicle'))
            this.vehicle2_.getComponent('steering_vehicle').evade(this.vehicle1_.getComponent('steering_vehicle'))
            this.vehicle3_.getComponent('steering_vehicle').evade(this.vehicle2_.getComponent('steering_vehicle'))
        }
        else if(this.behaviorIdx_ === 4)
        {
            this.vehicle1_.getComponent('steering_vehicle').wander()
            this.vehicle2_.getComponent('steering_vehicle').wander()
            this.vehicle3_.getComponent('steering_vehicle').wander()
        }
        else if(this.behaviorIdx_ === 5)
        {
            this.vehicle1_.getComponent('steering_vehicle').avoid(this.targets_.values())
            this.vehicle2_.getComponent('steering_vehicle').avoid(this.targets_.values())
            this.vehicle3_.getComponent('steering_vehicle').avoid(this.targets_.values())
        }
        else if(this.behaviorIdx_ === 6)
        {
            this.vehicle1_.getComponent('steering_vehicle').followPath(this.path_, true)
            this.vehicle2_.getComponent('steering_vehicle').followPath(this.path_, true)
            this.vehicle3_.getComponent('steering_vehicle').followPath(this.path_, true)

            bClear = false
        }
        else if(this.behaviorIdx_ === 7)
        {
            if(this.target_)
                this.vehicle1_.getComponent('steering_vehicle').seek(this.target_.position)
                
            for(let i = 0; i < this.group_.length; ++i)
            {
                this.group_[i].flock(this.group_)
            }
        }
        
        if(bClear && this.target_)
        {
            if(this.vehicle1_.getBoundingBox().contains(this.target_.position))
            {
                this.targets_.remove(this.target_.uuid)

                this.targetPool_.put(this.target_)

                if(this.targets_.size() > 0)
                    this.target_ = this.targets_.getFirst()
                else
                    this.target_ = null
            }
        }
    }

    onSwitch()
    {
        ++this.behaviorIdx_
        if(this.behaviorIdx_ >= kBehavior.length)
            this.behaviorIdx_ = 0

        this.lbl_.string = kBehavior[this.behaviorIdx_]
    }

    onExit()
    {
        GameLogic.instance.changeScene('load')
    }
}
