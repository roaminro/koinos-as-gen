// 
import {
  CodeGeneratorRequest,
  CodeGeneratorResponse,
} from "google-protobuf/google/protobuf/compiler/plugin_pb";
import * as fs from "fs";
import prettier from "prettier";
import path from "path";
import crypto from "crypto";
import { capitalize } from './util';
import { FileDescriptorProto } from "google-protobuf/google/protobuf/descriptor_pb";

const input = fs.readFileSync(process.stdin.fd);
let classTemplate = fs.readFileSync(path.resolve(__dirname, '../templates/contract-class-template.ts'), 'utf8').toString();
let indexTemplate = fs.readFileSync(path.resolve(__dirname, '../templates/index-template.ts'), 'utf8').toString();

try {
  const codeGenRequest = CodeGeneratorRequest.deserializeBinary(input);
  const codeGenResponse = new CodeGeneratorResponse();

  // there should be only 1 proto file
  if (codeGenRequest.getFileToGenerateList().length !== 1) {
    throw new Error("Only 1 proto file can be used to generate an ABI");
  }

  codeGenResponse.setSupportedFeatures(
    CodeGeneratorResponse.Feature.FEATURE_PROTO3_OPTIONAL
  );

  // there can be only 1 ABI file to generate, 
  // so the first file to generate is always the one used to generate the contract class
  const protoFileName = codeGenRequest.getFileToGenerateList()[0];
  let protoFileDescriptor: FileDescriptorProto | undefined;

  // iterate over the proto files to find the one that will be used to generate the contract class
  for (const fileDescriptor of codeGenRequest.getProtoFileList()) {
    const fileDescriptorName = fileDescriptor.getName();
    if (fileDescriptorName && fileDescriptorName === protoFileName) {
      protoFileDescriptor = fileDescriptor;
    }
  }

  if (protoFileDescriptor === undefined) {
    throw new Error(`Could not find a fileDescriptor for ${protoFileName}`);
  }

  const protoPackage = protoFileDescriptor.getPackage();
  if (!protoPackage) {
    throw new Error(`Could not find a package in ${protoFileName}, this is required`);
  }
  const contractClassName = capitalize(path.parse(protoFileName).base.replace(".proto", ""));

  // @ts-ignore
  classTemplate = classTemplate.replaceAll('##_CONTRACT_NAME_##', contractClassName);
  // @ts-ignore
  classTemplate = classTemplate.replaceAll('##_PROTO_PACKAGE_##', protoPackage);
  // @ts-ignore
  indexTemplate = indexTemplate.replaceAll('##_CONTRACT_NAME_##', contractClassName);
  // @ts-ignore
  indexTemplate = indexTemplate.replaceAll('##_PROTO_PACKAGE_##', protoPackage);


  let classEntryPoints = '';
  let indexEntryPoints = '';

  for (const messageDescriptor of protoFileDescriptor.getMessageTypeList()) {
    const messageName = messageDescriptor.getName();
  
    // only parse the messages ending with '_arguments'
    if (messageName?.endsWith('_arguments')) {
      const argumentsMessageDescriptor = messageDescriptor;
      const argumentsMessageName = messageName;
      const methodName = argumentsMessageName.replace('_arguments', '');
      const resultMessageName = `${methodName}_result`;

      // get the '_result' message
      // @ts-ignore: protoFileDescriptor cannot be undefined here
      const resultMessageDescriptor = protoFileDescriptor.getMessageTypeList().find(md => md.getName() === resultMessageName);

      if (resultMessageDescriptor === undefined) {
        throw new Error(`Could not find the message "${resultMessageName}", this is required`);
      }

      const args = `${protoPackage}.${argumentsMessageName}`;
      const res = `${protoPackage}.${resultMessageName}`;

      const argsFields = [];
      for (const fieldDescriptor of argumentsMessageDescriptor.getFieldList()) {
        const fieldName = fieldDescriptor.getName();
        if (fieldName) {
          argsFields.push(fieldName);
        }
      }

      const resFields = [];
      for (const fieldDescriptor of resultMessageDescriptor.getFieldList()) {
        const fieldName = fieldDescriptor.getName();
        if (fieldName) {
          resFields.push(fieldName);
        }
      }

      // generate entry points for the CONTRACT.boilerplate.ts file
      classEntryPoints += `
      ${methodName}(args: ${args}): ${res} {
        ${argsFields.map(field => `// const ${field} = args.${field};`).join('\n')}

        // YOUR CODE HERE

        const res = new ${res}();
        ${resFields.map(field => `// res.${field} = ;`).join('\n')}

        return res;
      }
      `;

      // generate entry points for the index.ts file
      const entryPoindIndex = `0x${crypto.createHash('sha256').update(methodName).digest('hex')}`.slice(0, 10);
      indexEntryPoints += `
      case ${entryPoindIndex}: {
        const args = Protobuf.decode<ProtoNamespace.${argumentsMessageName}>(rdbuf, ProtoNamespace.${argumentsMessageName}.decode);
        const res = c.${methodName}(args);
        retbuf = Protobuf.encode(res, ProtoNamespace.${resultMessageName}.encode);
        break;
      }
      `;
    }
  }

  // @ts-ignore
  classTemplate = classTemplate.replaceAll('##_ENTRY_POINTS_##', classEntryPoints);
  // @ts-ignore
  indexTemplate = indexTemplate.replaceAll('##_ENTRY_POINTS_##', indexEntryPoints);

  let formattedClassTemplate = classTemplate;
  try {
    formattedClassTemplate = prettier.format(classTemplate, {
      parser: "typescript",
    });
  } catch (error) {
    console.error(error);
  }

  let formattedIndexTemplate = indexTemplate;
  try {
    formattedIndexTemplate = prettier.format(indexTemplate, {
      parser: "typescript",
    });
  } catch (error) {
    console.error(error);
  }

  const outputClassFile = new CodeGeneratorResponse.File();
  outputClassFile.setName(contractClassName + ".boilerplate.ts");
  outputClassFile.setContent(formattedClassTemplate);
  codeGenResponse.addFile(outputClassFile);

  const outputIndexFile = new CodeGeneratorResponse.File();
  outputIndexFile.setName("index.ts");
  outputIndexFile.setContent(formattedIndexTemplate);
  codeGenResponse.addFile(outputIndexFile);

  process.stdout.write(Buffer.from(codeGenResponse.serializeBinary().buffer));
} catch (error) {
  console.log("An error occurred in koinos-abi-proto-gen generator plugin.");
  console.error(error);
  process.exit(1);
}
