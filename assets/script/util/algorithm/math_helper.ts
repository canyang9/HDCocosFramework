
export class MathHelper {
    static clamp(input: number, min: number, max: number)
    {
        return Math.max(Math.min(input, max), min)
    }
}