export interface Program { topLevelConstructs: TopLevelConstruct[]; };
export type TopLevelConstruct = Function | StaticVariable;
export interface Function {
    tag: "function"
    name: string;
    global: boolean;
    params: string[];
    body: Instruction[]
};
export interface StaticVariable {
    tag: "staticvariable";
    identifier: string;
    global: boolean;
    init: number;
};
export type Instruction =
    Return |
    Unary |
    Binary |
    Copy |
    Jump |
    JumpIfZero |
    JumpIfNotZero |
    Label |
    FunCall;
export type UnaryOp = "Complement" | "Negate" | "Not";
export interface Return { tag: "return"; value: Val };
export interface Unary { tag: "unary"; op: UnaryOp; src: Val; dst: Val };
export type BinaryOp =
    "Add" |
    "Subtract" |
    "Multiply" |
    "Divide" |
    "Remainder" |
    "And" |
    "Or" |
    "Equal" |
    "NotEqual" |
    "LessThan" |
    "LessOrEqual" |
    "GreaterThan" |
    "GreaterOrEqual";
export interface Binary {
    tag: "binary";
    op: BinaryOp;
    src1: Val;
    src2: Val;
    dst: Val;
};
export interface Copy { tag: "copy"; src: Val; dst: Val; };
export interface Jump { tag: "jump"; target: string; };
export interface JumpIfZero {
    tag: "jumpifzero";
    condition: Val;
    target: string;
};
export interface JumpIfNotZero {
    tag: "jumpifnotzero";
    condition: Val;
    target: string;
};
export interface Label { tag: "label"; value: string; };
export interface FunCall {
    tag: "fncall";
    name: string;
    args: Val[],
    dst: Val
};
export type Val = Constant | Var;
export interface Constant { tag: "constant"; value: number };
export interface Var { tag: "var"; value: string; };
