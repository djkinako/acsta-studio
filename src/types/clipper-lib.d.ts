declare module 'clipper-lib' {
  export interface IntPoint {
    X: number
    Y: number
  }
  export type ClipperPath = IntPoint[]
  export type ClipperPaths = IntPoint[][]

  export interface ClipperInstance {
    AddPaths(paths: ClipperPaths, polyType: number, closed: boolean): boolean
    Execute(
      clipType: number,
      solution: ClipperPaths,
      subjFillType?: number,
      clipFillType?: number,
    ): boolean
  }

  export interface ClipperOffsetInstance {
    ArcTolerance: number
    MiterLimit: number
    AddPaths(paths: ClipperPaths, joinType: number, endType: number): void
    Execute(solution: ClipperPaths, delta: number): void
    Clear(): void
  }

  const ClipperLib: {
    JoinType: { jtSquare: number; jtRound: number; jtMiter: number }
    EndType: {
      etOpenSquare: number
      etOpenRound: number
      etOpenButt: number
      etClosedLine: number
      etClosedPolygon: number
    }
    PolyType: { ptSubject: number; ptClip: number }
    ClipType: { ctIntersection: number; ctUnion: number; ctDifference: number; ctXor: number }
    PolyFillType: { pftEvenOdd: number; pftNonZero: number; pftPositive: number; pftNegative: number }
    Clipper: { new (initOptions?: number): ClipperInstance; Area(path: ClipperPath): number }
    ClipperOffset: { new (miterLimit?: number, arcTolerance?: number): ClipperOffsetInstance }
  }
  export default ClipperLib
}
