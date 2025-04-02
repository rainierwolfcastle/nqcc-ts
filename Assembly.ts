export type AsmType =
    "Byte" |
    "Longword" |
    "Quadword";

export interface Program { topLevelConstructs: TopLevelConstruct[]; };
export type TopLevelConstruct = Function | StaticVariable;
export interface Function {
    tag: "function";
    name: string;
    global: boolean;
    instructions: Instruction[];
    stackOffset: number
};
export interface StaticVariable {
    tag: "staticvariable";
    identifier: string;
    global: boolean;
    init: number;
};
export type Instruction =
    Mov |
    Unary |
    Binary |
    Cmp |
    Idiv |
    Cdq |
    Jmp |
    JmpCC |
    SetCC |
    Label |
    AllocateStack |
    DeallocateStack |
    Push |
    Call |
    Ret;
export type ConditionCode = "E" | "NE" | "G" | "GE" | "L" | "LE";
export interface Mov { tag: "mov"; src: Operand; dst: Operand; };
export interface Unary {
    tag: "unary";
    operator: UnaryOperator;
    operand: Operand;
};
export type BinaryOperator = "Add" | "Sub" | "Mult";
export interface Binary {
    tag: "binary";
    operator: BinaryOperator;
    src: Operand;
    dst: Operand;
};
export interface Cmp { tag: "cmp"; operand1: Operand; operand2: Operand; };
export interface Idiv { tag: "idiv"; operand: Operand; };
export interface Cdq { tag: "cdq" };
export interface Jmp { tag: "jmp"; identifier: string; }
export interface JmpCC {
    tag: "jmpcc";
    conditionCode: ConditionCode;
    identifier: string;
};
export interface SetCC {
    tag: "setcc";
    conditionCode: ConditionCode;
    operand: Operand;
};
export interface Label { tag: "label"; identifier: string; };
export interface AllocateStack { tag: "allocatestack"; value: string; };
export interface DeallocateStack { tag: "deallocateStack"; value: string; };
export interface Push { tag: "push"; operand: Operand; };
export interface Call { tag: "call"; identifier: string; };
export interface Ret { tag: "ret" };
export type Operand = Imm | Reg | Pseudo | Stack | Data;
export interface Imm { tag: "imm"; value: number; };
export type Register =
    "AX" |
    "CX" |
    "DX" |
    "DI" |
    "SI" |
    "R8" |
    "R9" |
    "R10" |
    "R11";
export interface Reg { tag: "reg"; value: Register };
export interface Pseudo { tag: "pseudo"; value: string; };
export interface Stack { tag: "stack"; value: number; };
export interface Data { tag: "data"; identifier: string };
export type UnaryOperator = "Neg" | "Not" | "Shr";
