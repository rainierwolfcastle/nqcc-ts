export type Type = Int | FunType;
export interface Int { tag: "int" };
export interface FunType { tag: "funtype"; paramCount: number };
