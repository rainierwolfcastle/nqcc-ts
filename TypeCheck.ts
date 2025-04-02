import * as Ast from "./Ast.ts";
import { FunType } from "./Types.ts";
import { FunAttr, InitialValue, StaticAttr, Symbol } from "./Symbols.ts";

export class TypeCheck {
    typeCheck(program: Ast.Program, symbolTable: Map<string, Symbol>): Ast.Program {
        return {
            funDecls: program.funDecls.map(fnDecl => this.typecheckGlobalDecl(fnDecl, symbolTable))
        };
    }

    private typecheckGlobalDecl(decl: Ast.Declaration, symbolTable: Map<string, Symbol>): Ast.Declaration {
        switch (decl.tag) {
            case "fundecl":
                return this.typeCheckFunctionDecl(decl, symbolTable);
            case "vardecl":
                return this.typeCheckFileScopeVariableDecl(decl, symbolTable);
        }
    }

    private typeCheckFunctionDecl(fnDecl: Ast.FunDecl, symbolTable: Map<string, Symbol>): Ast.FunDecl {
        const funType: FunType = { tag: "funtype", paramCount: fnDecl.params.length };
        const hasBody = fnDecl.body ? true : false;
        let alreadyDefined = false;
        let global = fnDecl.storageClass !== "Static";

        if (symbolTable.has(fnDecl.name)) {
            const oldDecl = symbolTable.get(fnDecl.name)!;

            if (oldDecl.type.tag !== "funtype" || (oldDecl.type.tag === "funtype" && oldDecl.type.paramCount !== fnDecl.params.length)) {
                throw new Error("Incompatible function declarations.");
            }

            const oldAttr = oldDecl.attrs as FunAttr;

            alreadyDefined = oldAttr.defined;

            if (alreadyDefined && hasBody) {
                throw new Error("Function is defined more than once.");
            }

            if (oldAttr.global && fnDecl.storageClass === "Static") {
                throw new Error("Static function declaration follows non-static.");
            }

            global = oldAttr.global;
        }

        const attrs: FunAttr = { tag: "funattr", defined: (alreadyDefined || hasBody), global };
        symbolTable.set(fnDecl.name, { type: funType, attrs });

        let body = undefined;
        if (fnDecl.body) {
            fnDecl.params.forEach(param => symbolTable.set(param, { type: { tag: "int" } }));
            body = this.typeCheckBlock(fnDecl.body, symbolTable);
        }

        return { tag: "fundecl", name: fnDecl.name, params: fnDecl.params, body, storageClass: fnDecl.storageClass };
    }

    private typeCheckFileScopeVariableDecl(decl: Ast.VarDecl, symbolTable: Map<string, Symbol>): Ast.VarDecl {
        let initialValue: InitialValue;

        if (decl.init === undefined) {
            if (decl.storageClass === "Extern") {
                initialValue = { tag: "noinitializer" };
            } else {
                initialValue = { tag: "tentative" };
            }
        } else if (decl.init.tag === "constant") {
            initialValue = { tag: "initial", value: decl.init.value };
        } else {
            throw new Error("Non-constant initializer.");
        }

        let global = (decl.storageClass !== "Static");

        if (symbolTable.has(decl.name)) {
            const oldDecl = symbolTable.get(decl.name)!;
            if (oldDecl.type.tag !== "int") {
                throw new Error("Function redeclared as variable");
            }
            if (decl.storageClass === "Extern") {
                global = (oldDecl.attrs as StaticAttr).global;
            } else if ((oldDecl.attrs as StaticAttr).global !== global) {
                throw new Error("Conflicting variable linkage.");
            }

            if ((oldDecl.attrs as StaticAttr).init.tag === "initial") {
                if (initialValue.tag === "initial") {
                    throw new Error("Conflicting file scope variable definitions.");
                } else {
                    initialValue = (oldDecl.attrs as StaticAttr).init;
                }
            } else if (initialValue.tag !== "initial" && (oldDecl.attrs as StaticAttr).init.tag === "tentative") {
                initialValue = { tag: "tentative" };
            }
        }

        const attrs: StaticAttr = { tag: "staticattr", init: initialValue, global };
        symbolTable.set(decl.name, { type: { tag: "int" }, attrs });

        return { tag: "vardecl", name: decl.name, init: decl.init, storageClass: decl.storageClass };
    }

    private typeCheckBlock(block: Ast.Block, symbolTable: Map<string, Symbol>): Ast.Block {
        return {
            tag: "block",
            blockItems: block.blockItems.map(blockItem => this.typeCheckBlockItem(blockItem, symbolTable))
        };
    }

    private typeCheckBlockItem(blockItem: Ast.BlockItem, symbolTable: Map<string, Symbol>): Ast.BlockItem {
        switch (blockItem.tag) {
            case "fundecl": {
                return this.typeCheckFunctionDecl(blockItem, symbolTable);
            }
            case "vardecl": return this.typeCheckLocalVariableDecl(blockItem, symbolTable);
            default: return this.typeCheckStatement(blockItem, symbolTable);
        }
    }

    private typeCheckLocalVariableDecl(decl: Ast.VarDecl, symbolTable: Map<string, Symbol>): Ast.VarDecl {
        if (decl.storageClass === "Extern") {
            if (decl.init !== undefined) {
                throw new Error("Initializer on local extern variable declaration.");
            }

            if (symbolTable.has(decl.name)) {
                const oldDecl = symbolTable.get(decl.name)!;
                if (oldDecl.type.tag !== "int") {
                    throw new Error("Function redeclared as variable.");
                }
            } else {
                symbolTable.set(decl.name, { type: { tag: "int" }, attrs: { tag: "staticattr", init: { tag: "noinitializer" }, global: true } });
            }
        } else if (decl.storageClass === "Static") {
            let initialValue: InitialValue;

            if (decl.init === undefined) {
                initialValue = { tag: "initial", value: 0 };
            } else if (decl.init.tag === "constant") {
                initialValue = { tag: "initial", value: decl.init.value };
            } else {
                throw new Error("Non-constant initializer on local static variable.");
            }

            symbolTable.set(decl.name, { type: { tag: "int" }, attrs: { tag: "staticattr", init: initialValue, global: false } });
        } else {
            symbolTable.set(decl.name, { type: { tag: "int" }, attrs: { tag: "localattr" } });
            if (decl.init !== undefined) {
                return { tag: "vardecl", name: decl.name, init: this.typeCheckExp(decl.init, symbolTable), storageClass: decl.storageClass };
            }
        }

        return { tag: "vardecl", name: decl.name, init: decl.init, storageClass: decl.storageClass };
    }

    private typeCheckExp(exp: Ast.Exp, symbolTable: Map<string, Symbol>): Ast.Exp {
        switch (exp.tag) {
            case "var": {
                if (symbolTable.get(exp.identifier)!.type.tag !== "int") {
                    throw new Error("Function name used as variable.");
                }
                return exp;
            }
            case "unary":
                return {
                    tag: "unary",
                    expression: this.typeCheckExp(exp.expression, symbolTable),
                    operator: exp.operator
                };
            case "binary":
                return {
                    tag: "binary",
                    operator: exp.operator,
                    left: this.typeCheckExp(exp.left, symbolTable),
                    right: this.typeCheckExp(exp.right, symbolTable)
                };
            case "assignment":
                return {
                    tag: "assignment",
                    left: this.typeCheckExp(exp.left, symbolTable),
                    right: this.typeCheckExp(exp.right, symbolTable)
                };
            case "conditional":
                return {
                    tag: "conditional",
                    condition: this.typeCheckExp(exp.condition, symbolTable),
                    else: this.typeCheckExp(exp.else, symbolTable),
                    then: this.typeCheckExp(exp.then, symbolTable)
                };
            case "functioncall": {
                const fnType = symbolTable.get(exp.name)!;
                if (fnType.type.tag === "int") throw new Error("Variable used as function name.");
                if (fnType.type.paramCount !== exp.args.length) throw new Error("Function called with the wrong number of arguments.");
                const args = exp.args.map(arg => this.typeCheckExp(arg, symbolTable));
                return { tag: "functioncall", name: exp.name, args };
            }
            default: return exp;
        }
    }

    private typeCheckForInit(forInit: Ast.ForInit, symbolTable: Map<string, Symbol>): Ast.ForInit {
        switch (forInit.tag) {
            case "initdecl": {
                if (forInit.declaration.storageClass) {
                    throw new Error("Storage class not permitted on declaration in for loop header.");
                }
                return {
                    tag: "initdecl",
                    declaration: this.typeCheckLocalVariableDecl(forInit.declaration, symbolTable)
                };
            }
            case "initexp":
                return {
                    tag: "initexp",
                    exp: forInit.exp ? this.typeCheckExp(forInit.exp, symbolTable) : undefined,
                }
        }
    }

    private typeCheckStatement(stmt: Ast.Statement, symbolTable: Map<string, Symbol>): Ast.Statement {
        switch (stmt.tag) {
            case "return":
                return {
                    tag: "return",
                    expression: this.typeCheckExp(stmt.expression, symbolTable)
                };
            case "expression":
                return {
                    tag: "expression",
                    expression: this.typeCheckExp(stmt.expression, symbolTable)
                };
            case "if":
                return {
                    tag: "if",
                    condition: this.typeCheckExp(stmt.condition, symbolTable),
                    then: this.typeCheckStatement(stmt.then, symbolTable),
                    else: stmt.else ? this.typeCheckStatement(stmt.else, symbolTable) : undefined,
                };
            case "compound":
                return {
                    tag: "compound",
                    block: this.typeCheckBlock(stmt.block, symbolTable)
                };
            case "while":
                return {
                    tag: "while",
                    condition: this.typeCheckExp(stmt.condition, symbolTable),
                    body: this.typeCheckStatement(stmt.body, symbolTable),
                    identifier: stmt.identifier
                };
            case "dowhile":
                return {
                    tag: "dowhile",
                    condition: this.typeCheckExp(stmt.condition, symbolTable),
                    body: this.typeCheckStatement(stmt.body, symbolTable),
                    identifier: stmt.identifier
                };
            case "for":
                return {
                    tag: "for",
                    forInit: this.typeCheckForInit(stmt.forInit, symbolTable),
                    condition: stmt.condition ? this.typeCheckExp(stmt.condition, symbolTable) : undefined,
                    post: stmt.post ? this.typeCheckExp(stmt.post, symbolTable) : undefined,
                    body: this.typeCheckStatement(stmt.body, symbolTable),
                    identifier: stmt.identifier,
                };
            default: return stmt;
        }
    }
}
