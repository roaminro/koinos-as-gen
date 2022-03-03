# koinos-as-gen
This is a `protoc` plugin to generate Koinos AssemblyScript Contract boilerplate code based on a proto file.

## Installation
```sh
# with npm
npm install --save-dev koinos-as-gen

# with yarn
yarn add --dev koinos-as-gen
```

## Important note
The plugin will generate a `CONTACT.boilerplate.ts` file and an `index.ts`, for this to work the proto file needs to follow these rules:
  - the proto file must like in a `proto` folder that is at the same level as the AssemblyScript files
  - arguments messages must be name as `METHODNAME_arguments`
  - result messages must be name as `METHODNAME_result`

## Usage

```sh
protoc --plugin=protoc-gen-as=./node_modules/.bin/koinos-as-gen --as_out=. myProtoFile.proto
```

## Example
The following proto file:
```proto
syntax = "proto3";

package calculator;

// @description Add two integers
// @read-only true
message add_arguments {
  int64 x = 1;
  int64 y = 2;
}

message add_result {
  int64 value = 1;
}
```

will generate the following `Calculator.boilerplate.ts file:
```js
import { calculator } from "./proto/calculator";

export class Calculator {
  add(args: calculator.add_arguments): calculator.add_result {
    // const x = args.x;
    // const y = args.y;

    // YOUR CODE HERE

    const res = new calculator.add_result();
    // res.value = ;

    return res;
  }
}
```

and will generate the following `index.ts file:
```js
import { System, Protobuf } from "koinos-as-sdk";
import { Calculator as ContractClass } from "./Calculator";
import { calculator as ProtoNamespace } from "./proto/calculator";

export function main(): i32 {
  const entryPoint = System.getEntryPoint();
  const rdbuf = System.getContractArguments();
  let retbuf = new Uint8Array(1024);

  const c = new ContractClass();

  switch (entryPoint) {
    case 0x7e9e5ac3: {
      const args = Protobuf.decode<ProtoNamespace.add_arguments>(
        rdbuf,
        ProtoNamespace.add_arguments.decode
      );
      const res = c.add(args);
      retbuf = Protobuf.encode(res, ProtoNamespace.add_result.encode);
      break;
    }

    default:
      System.exitContract(1);
      break;
  }

  System.setContractResult(retbuf);

  System.exitContract(0);
  return 0;
}

main();
```
