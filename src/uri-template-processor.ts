
interface RawExpression {
    start:number;
    end:number;
    template:string
}

type Expression = {
    operator?:string;
    operatorLevel:number | "reserved"
    variables:Variable[]
} & RawExpression

interface Variable {
    varname:string;
    prefix?:number;
    explode:boolean;
}

type Data = Record<string, string /**| string[] | Record<string,string>*/>;

// https://datatracker.ietf.org/doc/html/rfc6570
export class SimpleUriTemplateProcessor{

    public isTemplated(uri:string):boolean{
      return uri.indexOf('{')!=-1 && uri.indexOf('}')!=-1 
    }
  
    public expand(uri:string, data:Data):string{
        this.findExpressions(uri).map(this.parseExpression).forEach(expression=>{
            //TODO do better than replace
            uri = uri.replace(expression.template,this.expandExpression(expression,data))
        });
        return uri;
    }

    private findExpressions(uri:string):RawExpression[]{
        const expressions:RawExpression[] = [];
        let start:number | undefined;
        [...uri].forEach((c, i)=>{
            switch (c){
                case "{":
                    if(start){
                        throw "Open bracket already opened"
                    }else {
                        start = i;
                    }
                    break;
                case"}":
                    if(!start){
                        throw "Close bracket not opened"
                    }else {
                        const end = i;
                        expressions.push({
                            start,
                            end,
                            template:uri.substring(start,end+1)
                        })
                        start = undefined;
                    }
                    break;
            }
        });
        if(start){
            throw "Opened bracket not closed"
        }
        return expressions;
    }

    // private findExpressions(uri:string):RawExpression[]{
    //     const expressions:RawExpression[] = [];
    //     let start = uri.indexOf('{');
    //     while(start!=-1){
    //         let end = uri.indexOf('}', start+1);
    //         if(end==-1){
    //            throw "Opened bracket not closed"
    //         }
    //         expressions.push({
    //             start,
    //             end,
    //             template:uri.substring(start,end+1)
    //         })
    //         start = uri.indexOf('{', end+1);
    //     };
    //     return expressions;
    // }

    private parseExpression(expression:RawExpression):Expression{
        let template = expression.template;
        template = template.slice(1, template.length-1);
        if(!template.length){
            throw "Empty expression"
        }
        const firstChar = template.charAt(0);
        let operator:string | undefined;
        let operatorLevel:number | "reserved" = 1;//no operator
        switch(firstChar){
            case '+':
            case '#':
                operator = firstChar;
                operatorLevel = 2;
                break;
            case '.':
            case '/':
            case ';':
            case '?':
            case '&':
                operatorLevel = 3;
                operator = firstChar;
                break;
            case '=':
            case ',':
            case '!':
            case '@':
            case '|':
                operatorLevel = "reserved"
                operator = firstChar;
                break;
            default: operator = undefined
        }
        
        if(operator){
            template = template.slice(1)
        }

        //TODO https://datatracker.ietf.org/doc/html/rfc6570#section-2.3
        const variables = template.split(",").map(varspec =>{
            const explode = varspec.endsWith('*');

            const prefixStart = varspec.lastIndexOf(':');

            if(prefixStart!=-1 && explode){
                throw "Explode and prefix in the same varspec"
            }

            let varname:string;
            let prefix:number | undefined;
            if(explode){
                varname = varspec.slice(0,varspec.length-1)
            } else if (prefixStart!=-1){
                const prefixText = varspec.slice(prefixStart+1,varspec.length)
                if(prefixText.length>4){
                    throw "Prefix should be maximum 4 digits"
                }
                const validPrefix = [...prefixText].every(c=>c>="0" && c<="9")
                if(!validPrefix){
                    throw "Invalid characters in prefix"
                }
                prefix = parseInt(prefixText,10)
                varname = varspec.slice(0,prefixStart)
            } else {
                varname = varspec
            }
            
            const validVarname = [...varname].every((c,i)=>
                 c>="a" && c<="z"|| c>="A" && c<="Z" || c>="0" && c<="9" || c=="_" || (c=="%" && varname.charAt(i+1)=="2" && varname.charAt(i+2)=="5"))

            if(!validVarname){
                throw "Invalid characters in varname"
            }
            return {
                varname,
                explode,
                prefix

            } as Variable
        });
        
        return {
            operator,
            operatorLevel,
            variables,
            ...expression
        };
    }

    private expandExpression(expression:Expression, data:Data):string{
        if(expression.operatorLevel != 1){
            throw "Operator not supported: template processor level 1"
        }
        if(expression.variables.length>1){
            throw "Array not supported: template processor level 1"
        }

        const variable = expression.variables[0];
        if(variable.explode){
            throw "Explode not supported: template processor level 1"
        }
        if(variable.prefix){
            throw "Prefix not supported: template processor level 1"
        }
        
        const value = encodeURIComponent(data[variable.varname]);
        if(!value){
            throw "Can't find value for variable "+variable
        }
        return value;
    }
  
  }
  
const p = new SimpleUriTemplateProcessor();
console.log(p.expand("https://test.com{kid}o",{kid:"%;"}))

import * as UriTemplate from 'uritemplate';
var template = UriTemplate.parse('https://test.com{kid}o');
var result = template.expand({'kid': "%;"});
console.log(result)
