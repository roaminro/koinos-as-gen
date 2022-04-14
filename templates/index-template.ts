import { System, Protobuf, authorize_arguments, authorize_result } from "koinos-as-sdk";
import { ##_CONTRACT_NAME_## as ContractClass } from './##_CONTRACT_NAME_##';
import * as ProtoNamespace from "./proto/##_PROTO_PACKAGE_##";

export function main(): i32 {
  const entryPoint = System.getEntryPoint();
  const rdbuf = System.getContractArguments();
  let retbuf = new Uint8Array(##_RETURN_BUFFER_SIZE_##);

  const c = new ContractClass();

  switch (entryPoint) {
    ##_ENTRY_POINTS_##
    default:
      System.exitContract(1);
      break;
  }
  
  System.setContractResult(retbuf);
  
  System.exitContract(0);
  return 0;
}

main();