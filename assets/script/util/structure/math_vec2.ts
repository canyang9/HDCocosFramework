
export default class MathVec2 
{
    static isZero(v: cc.Vec2)
    {
        return v.x === 0 && v.y === 0
    }

    static setAngle(v: cc.Vec2, val: number)
    {
        let len = v.mag()
        v.x = Math.cos(val) * len
        v.y = Math.sin(val) * len
    }

    //弧度
    static getAngle(v: cc.Vec2)
    {
        return Math.atan2(v.y, v.x)
    }

    static getAngleDegree(v: cc.Vec2)
    {
        return this.getAngle(v) * 180 / Math.PI
    }

    static getAngleToCocosDegree(v: cc.Vec2)
    {
        return (Math.PI * 2 - this.getAngle(v)) * 180 / Math.PI
    }

    //设置向量大小（模）
    static setLength(v: cc.Vec2, val: number)
    {
        let agl = this.getAngle(v)
        v.x = Math.cos(agl) * val
        v.y = Math.sin(agl) * val
    }

    //设置向量模最大值
    static truncate(v: cc.Vec2, max: number)
    {
        let len = Math.min(max, v.mag())
        this.setLength(v, len)
    }

    //返回一个与传入向量垂直的向量（自身旋转90度）
    static perp(v: cc.Vec2)
    {
        return new cc.Vec2(-v.y, v.x)
    }

    //返回二个矢量末端顶点的距离平方值
    static distanceSqrt(v1: cc.Vec2, v2: cc.Vec2)
    {
        let dx = v2.x - v1.x
        let dy = v2.y - v1.y
        return dx * dx + dy * dy
    }

    //返回二个矢量末端顶点的距离
    static distance(v1: cc.Vec2, v2: cc.Vec2)
    {
        return Math.sqrt(this.distanceSqrt(v1, v2))
    }

    //判断v2是在v1左侧还是右侧，左侧返回-1，右侧返回1
    static sign(v1: cc.Vec2, v2: cc.Vec2)
    {
        return this.perp(v1).dot(v2) < 0 ? -1 : 1
    }

    //获取节点相对父节点的X轴朝向
    public getForwardOfParent(node: cc.Node)
    {
        let vForward = cc.v2(1,0);
        let nRotation = node.rotation % 360;
        if(nRotation > 0)
        {
            nRotation = 360 - nRotation;
        }
        else if(nRotation < 0)
        {
            nRotation = Math.abs(nRotation);
        }
        
        let nRotate = Math.PI / 180 * nRotation;
        return vForward.rotateSelf(nRotate).normalize();
    }

    public lookAt(target: cc.Node)
    {
        //计算出朝向
        let dx = target.x - this.node.x;
        let dy = target.y - this.node.y;
        let dir = cc.v2(dx,dy);

        //根据朝向计算出夹角弧度
        let angle = dir.signAngle(cc.v2(1,0));

        //将弧度转换为欧拉角
        let degree = angle / Math.PI * 180;

        return degree
    }
}
