export type Program = { funDecls: Declaration[]; };
export type Declaration = FunDecl | VarDecl;
export interface VarDecl {
    tag: "vardecl";
    name: string;
    init?: Exp;
    storageClass?: StorageClass
};
export interface FunDecl {
    tag: "fundecl";
    name: string;
    params: string[];
    body?: Block;
    storageClass?: StorageClass
};
export interface Function { name: string; body: Block };
export type StorageClass = "Int" | "Static" | "Extern";
export type BlockItem = Statement | Declaration;
export interface Block { tag: "block"; blockItems: BlockItem[] };
export type ForInit = InitDecl | InitExp;
export type Statement =
    Return |
    Expression |
    If |
    Compound |
    Break |
    Continue |
    While |
    DoWhile |
    For |
    Null;
export interface Return { tag: "return"; expression: Exp; };
export interface Expression { tag: "expression"; expression: Exp; };
export interface If {
    tag: "if";
    condition: Exp;
    then: Statement;
    else?: Statement
};
export interface Compound { tag: "compound"; block: Block };
export interface Break { tag: "break", identifier: string };
export interface Continue { tag: "continue", identifier: string };
export interface While {
    tag: "while",
    condition: Exp,
    body: Statement,
    identifier: string
};
export interface DoWhile {
    tag: "dowhile",
    body: Statement,
    condition: Exp,
    identifier: string
};
export interface InitDecl { tag: "initdecl", declaration: VarDecl };
export interface InitExp { tag: "initexp", exp?: Exp };
export interface For {
    tag: "for",
    forInit: ForInit,
    condition?: Exp,
    post?: Exp,
    body: Statement,
    identifier: string
};
export interface Null { tag: "null"; };
export type Exp =
    Constant |
    Var |
    Unary |
    Binary |
    Assignment |
    Conditional |
    FunctionCall;
export interface Constant { tag: "constant"; value: number; };
export interface Var { tag: "var"; identifier: string; };
export interface Unary { tag: "unary"; operator: UnaryOp; expression: Exp; };
export interface Binary {
    tag: "binary";
    operator: BinaryOp;
    left: Exp;
    right: Exp;
};
export interface Assignment { tag: "assignment"; left: Exp; right: Exp; };
export interface Conditional {
    tag: "conditional";
    condition: Exp;
    then: Exp;
    else: Exp
};
export interface FunctionCall {
    tag: "functioncall";
    name: string;
    args: Exp[];
};
export type UnaryOp = "Complement" | "Negate" | "Not";
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
