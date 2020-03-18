
export class HDBezier {
    /**
     * 获取贝塞尔曲线点
     * @param anchorPoints 控制点数组，需要传入三个点 [ start, mid, end ]
     * @param pointsAmount 曲线上生成点数量，例如传入4，最终返回的会带上起点与终点，总共6个点
     * @return 返回起点和终点，以及曲线上生成的点
     */
    public static getPoints(anchorPoints: cc.Vec2[], pointsAmount: number) : Array<any> {
        let points = [];
        let cnt = pointsAmount + 1
        for (let i = 0; i <= cnt; i++) {
            let point = this._multiPointBezier(anchorPoints, i / cnt);
            points.push(point);
        }
        return points;
    }
 
    private static _multiPointBezier(points, t): any {
        let len:number = points.length;
        let x:number = 0, y:number = 0;
        for (let i:number = 0; i < len; i++) {
            let point:any = points[i];
            x += point.x * Math.pow((1 - t), (len - 1 - i)) * Math.pow(t, i) * (this._binomial(len - 1, i));
            y += point.y * Math.pow((1 - t), (len - 1 - i)) * Math.pow(t, i) * (this._binomial(len - 1, i));
        }
        return { x: x, y: y };
    }
 
    private static _binomial(start: number, end: number): number {
        let cs = 1, bcs = 1;
        while (end > 0) {
            cs *= start;
            bcs *= end;
            --start;
            --end;
        }
        return (cs / bcs);
     };
}
