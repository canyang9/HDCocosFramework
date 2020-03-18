import MathVec2 from "../structure/math_vec2";

//版边行为
const EdgeBehavior = cc.Enum({
    kWrap: 0, //环绕
    kBounce: 1, //回弹
})

const {ccclass, property} = cc._decorator;

//转向行为基类，可以自行继承实现新功能，转向行为计算较为密集，注意关注性能
@ccclass
export class SteeringVehicleBase extends cc.Component {
    @property({ type: cc.Rect, displayName: "Edge", tooltip: "边界" })
    protected edge_: cc.Rect = new cc.Rect()

    @property({ type: cc.Vec2, displayName: "Velocity", tooltip: "速度" })
    protected velocity_: cc.Vec2 = new cc.Vec2(0, 0)

    @property({ type: EdgeBehavior, displayName: "Edge Behavior", tooltip: "版边行为，可以自行继承修改" })
    protected edgeBehavior_ = EdgeBehavior.kWrap //版边行为

    @property({ type: cc.Float, displayName: "Mass", tooltip: "质量" })
    protected mass_ = 1 //质量

    @property({ type: cc.Float, displayName: "MaxSpeed", tooltip: "最大移动速度" })
    protected maxSpeed_ = 10 //最大移动速度

    @property({ type: cc.Float, displayName: "MaxForce", tooltip: "最大牵引力" })
    protected maxForce_ = 1 //最大牵引力，避免过快的转身

    @property({ type: cc.Float, displayName: "ArrivalThreshold", 
        tooltip: "到达阈值，到达行为专用，距离目标多远开始减速" })
    protected arrivalThreshold_ = 100

    @property({ type: cc.Float, displayName: "WanderDistance", 
        tooltip: "漫游目标距离，漫游行为专用，用于推算当前的漫游目标点与自身可能存在的距离" })
    protected wanderDist_ = 10

    @property({ type: cc.Float, displayName: "WanderRadius", 
        tooltip: "漫游推算半径，漫游行为专用，用于推算目标点在漫游目标区域中可能存在的位置范围" })
    protected wanderRad_ = 5

    @property({ type: cc.Float, displayName: "WanderRange", 
        tooltip: "漫游范围，漫游行为专用，用于推算本次漫游的可能偏移距离" })
    protected wanderRange_ = 1

    @property({ type: cc.Float, displayName: "AvoidDistance", 
        tooltip: "回避检测距离，回避行为专用，计算提前多远回避障碍物" })
    protected avoidDist_ = 100

    @property({ type: cc.Float, displayName: "AvoidBuffer", 
        tooltip: "回避缓冲距离，回避行为专用，在准备避开时，自身和障碍物间的预留距离" })
    protected avoidBuffer_ = 10

    @property({ type: cc.Integer, displayName: "PathIndex", 
        tooltip: "路径索引，路径跟随行为专用，用于获取当前路径数组中的某个路点" })
    protected pathIdx_ = 0

    @property({ type: cc.Float, displayName: "PathThreshold", 
        tooltip: "路径距离阈值，路径跟随行为专用，用于检查是否靠近了某个路点以便寻找下一个" })
    protected pathThreshold_ = 20

    @property({ type: cc.Float, displayName: "SightDist", 
        tooltip: "视野距离，群落行为专用，用于群落中个体能够检测到有效实体的范围" })
    protected sightDist_ = 200

    @property({ type: cc.Float, displayName: "SafeDist", 
        tooltip: "安全距离，群落行为专用，用于群落中个体间保有的间距" })
    protected safeDist_ = 60

    @property({ type: cc.Boolean, displayName: "bAuto", tooltip: "自动运动" })
    protected bAuto_ = false

    protected steeringForce_: cc.Vec2 = new cc.Vec2(0, 0)

    protected wanderAngle_ = 0

    protected avoidVelocityRec_: cc.Vec2 = null //回避前的速度记录，用于恢复原始速度

    set edgeBehavior(val: number)
    {
        this.edgeBehavior_ = val
    }

    get edgeBehavior()
    {
        return this.edgeBehavior_
    }

    set mass(val: number)
    {
        this.mass_ = val
    }

    get mass()
    {
        return this.mass_
    }

    set maxSpeed(val: number)
    {
        this.maxSpeed_ = val
    }

    get maxSpeed()
    {
        return this.maxSpeed_
    }

    set velocity(val: cc.Vec2)
    {
        this.velocity_.set(val)
    }

    get velocity()
    {
        return this.velocity_
    }

    set maxForce(val: number)
    {
        this.maxForce_ = val
    }

    get maxForce()
    {
        return this.maxForce_
    }

    set arrivalThreshold(val: number)
    {
        this.arrivalThreshold_ = val
    }

    get arrivalThrehold()
    {
        return this.arrivalThreshold_
    }

    set wanderDistance(val: number)
    {
        this.wanderDist_ = val
    }

    get wanderDistance()
    {
        return this.wanderDist_
    }

    set wanderRadius(val: number)
    {
        this.wanderRad_ = val
    }

    get wanderRadius()
    {
        return this.wanderRad_
    }

    set wanderRange(val: number)
    {
        this.wanderRange_ = val
    }

    get wanderRange()
    {
        return this.wanderRange_
    }

    set avoidDistance(val: number)
    {
        this.avoidDist_ = val
    }

    get avoidDistance()
    {
        return this.avoidDist_
    }

    set avoidBuffer(val: number)
    {
        this.avoidBuffer_ = val
    }

    get avoidBuffer()
    {
        return this.avoidBuffer_
    }

    set pathIndex(val: number)
    {
        this.pathIdx_ = val
    }

    get pathIndex()
    {
        return this.pathIdx_
    }

    set pathThrehold(val: number)
    {
        this.pathThreshold_ = val
    }

    get pathThrehold()
    {
        return this.pathThreshold_
    }

    set sightDistance(val: number)
    {
        this.sightDist_ = val
    }

    get sightDistance()
    {
        return this.sightDist_
    }

    set safeDistance(val: number)
    {
        this.safeDist_ = val
    }

    get safeDistance()
    {
        return this.safeDist_
    }

    seek(target: cc.Vec2)
    {
        let desiredV = target.sub(this.node.position)
        desiredV = desiredV.normalize()
        desiredV = desiredV.mul(this.maxSpeed_)

        let force = desiredV.sub(this.velocity_)
        this.steeringForce_ = this.steeringForce_.add(force)

        // cc.log('seek', target, desiredV, this.steeringForce_)
    }

    flee(target: cc.Vec2)
    {
        let desiredV = target.sub(this.node.position)
        desiredV = desiredV.normalize()
        desiredV = desiredV.mul(this.maxSpeed_)

        let force = desiredV.sub(this.velocity_)
        this.steeringForce_ = this.steeringForce_.sub(force)
    }

    arrive(target: cc.Vec2)
    {
        let desiredV = target.sub(this.node.position)
        desiredV = desiredV.normalize()
        let dist = MathVec2.distance(this.node.position, target)
        if(dist > this.arrivalThreshold_)
            desiredV = desiredV.mul(this.maxSpeed_)
        else
            desiredV = desiredV.mul(this.maxSpeed_ * dist / this.arrivalThreshold_)

        let force = desiredV.sub(this.velocity_)
        this.steeringForce_ = this.steeringForce_.add(force)
    }

    pursue(target: SteeringVehicleBase)
    {
        //假如目标不动，追捕者开足马力赶过去的话，计算需要多少时间，此处算法仅为简单算法
        let lookAheadTime = MathVec2.distance(this.node.position, target.node.position) / this.maxSpeed_
        
        let predictedTarget = target.node.position.add(target.velocity.mul(lookAheadTime))
        this.seek(predictedTarget)
    }

    evade(target: SteeringVehicleBase)
    {
        let lookAheadTime = MathVec2.distance(this.node.position, target.node.position) / this.maxSpeed_
        
        let predictedTarget = target.node.position.add(target.velocity.mul(lookAheadTime))
        this.flee(predictedTarget)
    }

    wander()
    {
        let center = this.velocity_.normalize().mul(this.wanderDist_)
        let offset = new cc.Vec2(0, 0)
        MathVec2.setLength(offset, this.wanderRad_)
        MathVec2.setAngle(offset, this.wanderAngle_)

        this.wanderAngle_ += (Math.random() - 0.5) * this.wanderRange_

        let force = center.add(offset)
        this.steeringForce_ = this.steeringForce_.add(force)
    }

    //此处传入的为圆形碰撞区域，需要更换碰撞预测计算，可考虑自行继承实现
    avoid(circles: cc.Node[])
    {
        for(let i = 0; i < circles.length; ++i)
        {
            let circle = circles[i]
            let heading = this.velocity_.normalize()
            let diff = circle.position.sub(this.node.position)
            let dotProd = diff.dot(heading)

            //点积为锐角，障碍物在前方，需要减速
            if(dotProd > 0) 
            {
                if(this.avoidVelocityRec_ === null)
                    this.avoidVelocityRec_ = cc.v2(this.velocity_)

                //感知探针
                let feeler = heading.mul(this.avoidDist_)
                //位移在探针上的投影
                let proj = heading.mul(dotProd)
                //障碍物与探针的距离
                let dist = proj.sub(diff).mag()

                //如果探针在缓冲范围内与障碍物香蕉，且位移映射长度小于探针长度
                //则判断为碰撞即将发生，需要转向
                let collider = circle.getComponent(cc.CircleCollider)
                if(collider)
                {
                    if(dist < collider.radius + this.avoidBuffer_ && proj.mag() < feeler.mag())
                    {
                        //计算一个转90度的牵引力
                        let force = heading.mul(this.maxSpeed_)
                        let agl = MathVec2.getAngle(force)
                        MathVec2.setAngle(force, agl + MathVec2.sign(diff, this.velocity_) * Math.PI / 2)
                        let ratio = proj.mag() / feeler.mag()
                        //通过离障碍物的距离，调整力度大小，使之足够小但是能够避开
                        force = force.mul(1 - ratio)
                        this.steeringForce_ = this.steeringForce_.add(force)
                        //转弯时放慢速度，离障碍物越近，减速越大
                        this.velocity_ = this.velocity_.mul(ratio)
                    }
                }
            }
            else //离开了障碍物，可以加速了
            {
                if(this.avoidVelocityRec_ && 
                    MathVec2.distance(this.node.position, circle.position) > this.avoidDist_)
                {
                    this.velocity_.set(this.avoidVelocityRec_)
                    this.avoidVelocityRec_ = null
                }
            }
        }
    }

    followPath(path: cc.Vec2[], bLoop = false)
    {
        if(this.pathIdx_ >= 0 && this.pathIdx_ < path.length)
        {
            let pnt = path[this.pathIdx_]
            if(MathVec2.distance(this.node.position, pnt) < this.pathThreshold_)
            {
                if(this.pathIdx_ >= path.length - 1)
                {
                    if(bLoop)
                        this.pathIdx_ = 0
                }
                else
                    ++this.pathIdx_
            }

            if(this.pathIdx_ >= path.length - 1 && !bLoop)
                this.arrive(pnt)
            else
                this.seek(pnt)
        }
    }

    flock(group: SteeringVehicleBase[])
    {
        let avgV = this.velocity_.clone() //平均速度变量
        let avgPos = cc.v2(0, 0) //平均位置变量
        let inSightCnt = 0

        for(let i = 0; i < group.length; ++i)
        {
            let target = group[i]
            if(target !== this && this._isInSight(target))
            {
                avgV = avgV.add(target.velocity)
                avgPos = avgPos.add(target.node.position)

                if(this._isNotSafeDist(target))
                    this.flee(target.node.position)

                ++inSightCnt
            }
        }

        if(inSightCnt > 0)
        {
            avgV = avgV.div(inSightCnt)
            avgPos = avgPos.div(inSightCnt)
            this.seek(avgPos)
            //根据平均速度校准自身速度
            this.steeringForce_ = this.steeringForce_.add(avgV.sub(this.velocity_))
        }
    }

    protected _isInSight(target: SteeringVehicleBase)
    {
        let bRet = true
        if(MathVec2.distance(this.node.position, target.node.position) > this.sightDist_)
            bRet = false

        //----可去掉的代码，影响群落行为
        let heading = this.velocity_.normalize()
        let diff = target.node.position.sub(this.node.position)
        let dotProd = diff.dot(heading)
        if(dotProd < 0)
            bRet = false

        return bRet
    }

    protected _isNotSafeDist(target: SteeringVehicleBase)
    {
        return MathVec2.distance(this.node.position, target.node.position) < this.safeDist_
    }

    update(dt: number)
    {
        if(this.bAuto_)
            this.updateBehavior()
    }

    updateBehavior()
    {
        this._updateSteering()

        MathVec2.truncate(this.velocity_, this.maxSpeed_)

        this.node.position = this.node.position.add(this.velocity_)

        if(this.edgeBehavior_ === EdgeBehavior.kWrap)
            this._wrap()
        else if(this.edgeBehavior_ === EdgeBehavior.kBounce)
            this._bounce()

        this.node.rotation = MathVec2.getAngleToCocosDegree(this.velocity_)

        // cc.log("updateBehavior", this.node.position, this.velocity_, this.node.rotation)
    }

    protected _updateSteering()
    {
        MathVec2.truncate(this.steeringForce_, this.maxForce_)
        this.steeringForce_ = this.steeringForce_.div(this.mass_)

        this.velocity_ = this.velocity_.add(this.steeringForce_)
        this.steeringForce_.set(cc.v2(0, 0))
    }

    protected _bounce()
    {
        if(this.node.x > this.edge_.xMax)
        {
            this.node.x = this.edge_.xMax
            this.velocity_.x *= -1
        }
        else if(this.node.x < this.edge_.xMin)
        {
            this.node.x = this.edge_.xMin
            this.velocity_.x *= -1
        }

        if(this.node.y > this.edge_.yMax)
        {
            this.node.y = this.edge_.yMax
            this.velocity_.y *= -1
        }
        else if(this.node.y < this.edge_.yMin)
        {
            this.node.y = this.edge_.yMin
            this.velocity_.y *= -1
        }
    }

    protected _wrap()
    {
        if(this.node.x > this.edge_.xMax)
            this.node.x = this.edge_.xMin
        else if(this.node.x < this.edge_.xMin)
            this.node.x = this.edge_.xMax

        if(this.node.y > this.edge_.yMax)
            this.node.y = this.edge_.yMin
        else if(this.node.y < this.edge_.yMin)
            this.node.y = this.edge_.yMax
    }
}
