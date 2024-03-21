import { System, Protobuf, authority } from "@roamin/koinos-sdk-as";
import { ##_CONTRACT_NAME_## as ContractClass } from './##_CONTRACT_NAME_##';
import { ##_PROTO_PACKAGE_## as ProtoNamespace } from "./proto/##_PROTO_PACKAGE_##";

export function main(): i32 {
  const contractArgs = System.getArguments();
  let retbuf = new Uint8Array(##_RETURN_BUFFER_SIZE_##);

  const c = new ContractClass();

  switch (contractArgs.entry_point) {
    ##_ENTRY_POINTS_##
    default:
      System.exit(1);
      break;
  }

  System.exit(0, retbuf);
  return 0;
}

main();