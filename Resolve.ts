import * as Ast from "./Ast.ts";
import { UniqueId } from "./UniqueId.ts";

interface MapEntry { name: string, fromCurrentScope: boolean, hasLinkage: boolean };

export class Resolve {
    resolve(program: Ast.Program): Ast.Program {
        const identifierMap = new Map<string, MapEntry>();
        return { funDecls: program.funDecls.map(decl => this.resolveDeclaration(decl, identifierMap)) };
    }

    private resolveDeclaration(decl: Ast.Declaration, identifierMap: Map<string, MapEntry>): Ast.Declaration {
        switch(decl.tag) {
            case "fundecl":
                return this.resolveFunctionDeclaration(decl, identifierMap);
            case "vardecl":
                return this.resolveFileScopeVariableDeclaration(decl, identifierMap);
        }
    }

    private resolveFunctionDeclaration(decl: Ast.FunDecl, identifierMap: Map<string, MapEntry>): Ast.FunDecl {
        if (identifierMap.has(decl.name)) {
            const prevEntry = identifierMap.get(decl.name)!;
            if (prevEntry.fromCurrentScope && prevEntry.hasLinkage === false) {
                throw new Error("Duplicate Declaration.");
            }
        }

        identifierMap.set(decl.name, { name: decl.name, fromCurrentScope: true, hasLinkage: true });

        const innerMap = this.copyIdentifierMap(identifierMap);
        const newParams = decl.params.map(param => this.resolveParam(param, innerMap));

        let newBody = undefined;
        if (decl.body) {
            newBody = this.resolveBlock(decl.body, innerMap);
        }

        return { tag: "fundecl", name: decl.name, params: newParams, body: newBody, storageClass: decl.storageClass };
    }

    private copyIdentifierMap(identifierMap: Map<string, MapEntry>): Map<string, MapEntry> {
        return new Map(Array.from(identifierMap, ([key, { name, hasLinkage }]) => [key, { name, fromCurrentScope: false, hasLinkage }]));
    }

    private resolveParam(param: string, identifierMap: Map<string, MapEntry>): string {
        if (identifierMap.has(param) && identifierMap.get(param)!.fromCurrentScope) {
            throw new Error("Duplicate param declaration.");
        }
        const newName = UniqueId.makeLabel(param);
        identifierMap.set(param, { name: newName, fromCurrentScope: true, hasLinkage: false });
        return newName;
    }

    private resolveBlock(block: Ast.Block, identifierMap: Map<string, MapEntry>): Ast.Block {
        const blockItems = block.blockItems.map(x => this.resolveBlockItem(x, identifierMap));
        return { tag: "block", blockItems };
    }

    private resolveBlockItem(blockItem: Ast.BlockItem, identifierMap: Map<string, MapEntry>): Ast.BlockItem {
        switch (blockItem.tag) {
            case "vardecl":
            case "fundecl":
                return this.resolveLocalDeclaration(blockItem, identifierMap);
            default:
                return this.resolveStatement(blockItem, identifierMap);
        }
    }

    private resolveLocalDeclaration(decl: Ast.Declaration, identifierMap: Map<string, MapEntry>): Ast.Declaration {
        switch (decl.tag) {
            case "vardecl":
                return this.resolveLocalVariableDeclaration(decl, identifierMap);
            case "fundecl":
                if (decl.body) throw new Error("Nested function definitions are not allowed.");
                if (decl.storageClass === "Static") throw new Error("Static keyword not allowed on local function declarations");
                return this.resolveFunctionDeclaration(decl, identifierMap);
        }
    }

    private resolveLocalVariableDeclaration(decl: Ast.VarDecl, identifierMap: Map<string, MapEntry>): Ast.VarDecl {
        if (identifierMap.has(decl.name)) {
            const prevEntry = identifierMap.get(decl.name)!;
            if (prevEntry.fromCurrentScope) {
                if (!(prevEntry.hasLinkage && decl.storageClass === "Extern")) {
                    throw new Error("Conflicting local declarations.");
                }
            }
        }

        if (decl.storageClass === "Extern") {
            identifierMap.set(decl.name, { name: decl.name, fromCurrentScope: true, hasLinkage: true });
            return decl;
        } else {
            const name = UniqueId.makeLabel(decl.name);
            identifierMap.set(decl.name, { name, fromCurrentScope: true, hasLinkage: false });
            const init = decl.init ? this.resolveExp(decl.init, identifierMap) : undefined;
            return { tag: "vardecl", name, init, storageClass: decl.storageClass };
        }
    }

    private resolveExp(exp: Ast.Exp, identifierMap: Map<string, MapEntry>): Ast.Exp {
        switch (exp.tag) {
            case "var": {
                if (identifierMap.has(exp.identifier)) {
                    return {
                        tag: "var",
                        identifier: identifierMap.get(exp.identifier)!.name
                    };
                }
                throw new Error("Undeclared variable.");
            }
            case "unary":
                return {
                    tag: "unary",
                    operator: exp.operator,
                    expression: this.resolveExp(exp.expression, identifierMap)
                }
            case "binary":
                return {
                    tag: "binary",
                    operator: exp.operator,
                    left: this.resolveExp(exp.left, identifierMap),
                    right: this.resolveExp(exp.right, identifierMap)
                };
            case "assignment": {
                if (exp.left.tag !== "var") throw new Error("Invalid lvalue.");
                return {
                    tag: "assignment",
                    left: this.resolveExp(exp.left, identifierMap),
                    right: this.resolveExp(exp.right, identifierMap)
                }
            }
            case "conditional":
                return {
                    tag: "conditional",
                    condition: this.resolveExp(exp.condition, identifierMap),
                    then: this.resolveExp(exp.then, identifierMap),
                    else: this.resolveExp(exp.else, identifierMap)
                }
            case "functioncall": {
                if (identifierMap.has(exp.name)) {
                    return {
                        tag: "functioncall",
                        name: identifierMap.get(exp.name)!.name,
                        args: exp.args.map(arg => this.resolveExp(arg, identifierMap))
                    };
                }
                throw new Error("Undeclared function.");
            }
            case "constant": return exp;
        }
    }

    private resolveStatement(statement: Ast.Statement, identifierMap: Map<string, MapEntry>): Ast.Statement {
        switch (statement.tag) {
            case "return":
                return {
                    tag: "return",
                    expression: this.resolveExp(statement.expression, identifierMap)
                };
            case "expression":
                return {
                    tag: "expression",
                    expression: this.resolveExp(statement.expression, identifierMap)
                };
            case "if":
                return {
                    tag: "if",
                    condition: this.resolveExp(statement.condition, identifierMap),
                    then: this.resolveStatement(statement.then, identifierMap),
                    else: statement.else ? this.resolveStatement(statement.else, identifierMap) : undefined
                };
            case "compound":
                return {
                    tag: "compound",
                    block: this.resolveBlock(statement.block, this.copyIdentifierMap(identifierMap))
                };
            case "break": return { tag: "break", identifier: statement.identifier };
            case "continue": return { tag: "continue", identifier: statement.identifier };
            case "while": {
                return {
                    tag: "while",
                    body: this.resolveStatement(statement.body, identifierMap),
                    condition: this.resolveExp(statement.condition, identifierMap),
                    identifier: statement.identifier
                };
            }
            case "dowhile":
                return {
                    tag: "dowhile",
                    condition: this.resolveExp(statement.condition, identifierMap),
                    body: this.resolveStatement(statement.body, identifierMap),
                    identifier: statement.identifier
                };
            case "for": {
                const newidentifierMap = this.copyIdentifierMap(identifierMap);
                return {
                    tag: "for",
                    forInit: this.resolveForInit(statement.forInit, newidentifierMap),
                    condition: this.resolveOptionalExp(statement.condition, newidentifierMap),
                    post: this.resolveOptionalExp(statement.post, newidentifierMap),
                    body: this.resolveStatement(statement.body, newidentifierMap),
                    identifier: statement.identifier
                };
            }
            case "null": return { tag: "null" };
        }
    }

    private resolveOptionalExp(exp: Ast.Exp | undefined, identifierMap: Map<string, MapEntry>): Ast.Exp | undefined {
        return exp ? this.resolveExp(exp, identifierMap) : undefined;
    }

    private resolveForInit(init: Ast.ForInit, identifierMap: Map<string, MapEntry>): Ast.ForInit {
        switch (init.tag) {
            case "initdecl":
                return {
                    tag: "initdecl",
                    declaration: this.resolveLocalVariableDeclaration(init.declaration, identifierMap)
                };
            case "initexp":
                return {
                    tag: "initexp",
                    exp: this.resolveOptionalExp(init.exp, identifierMap)
                };
        }
    }

    private resolveFileScopeVariableDeclaration(decl: Ast.Declaration, identifierMap: Map<string, MapEntry>): Ast.Declaration {
        identifierMap.set(
            decl.name,
            {
                name: decl.name,
                fromCurrentScope: true,
                hasLinkage: true
            }
        );
        return decl;
    }
}
