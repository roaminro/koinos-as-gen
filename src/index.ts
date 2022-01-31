// 
import {
  CodeGeneratorRequest,
  CodeGeneratorResponse,
} from "google-protobuf/google/protobuf/compiler/plugin_pb";
import * as fs from "fs";
import * as assert from "assert";
import prettier from "prettier";
import path from "path";
import crypto from "crypto";
import { capitalize } from './util';

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
  let protoFileDescriptor;

  // iterate over the proto files to find the one that will be used to generate the contract class
  for (const fileDescriptor of codeGenRequest.getProtoFileList()) {
    const fileDescriptorName = fileDescriptor.getName();
    assert.ok(fileDescriptorName);
    if (fileDescriptorName === protoFileName) {
      protoFileDescriptor = fileDescriptor;
    }
  }

  if (!protoFileDescriptor) {
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
  protoFileDescriptor.getMessageTypeList().forEach((messageDescriptor) => {
    const argumentsMessageName = messageDescriptor.getName();

    // only parse the messages ending with '_arguments'
    if (argumentsMessageName?.endsWith('_arguments')) {
      const methodName = argumentsMessageName.replace('_arguments', '');
      const resultMessageName = `${methodName}_result`;
      const args = `${protoPackage}.${argumentsMessageName}`;
      const res = `${protoPackage}.${resultMessageName}`;

      classEntryPoints += `
      ${methodName}(args: ${args}): ${res} {
        // YOUR CODE HERE
        return new ${res}();
      }
      `;

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
  });

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
