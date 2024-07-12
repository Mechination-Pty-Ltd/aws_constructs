const sm = require("@aws-sdk/client-secrets-manager");
const crypto = require("crypto");

const sm_client = new sm.SecretsManagerClient({});

async function onCreate(evt) {
  const { SecretId, Description, additionalProperties } = evt.ResourceProperties;
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  // Turn the Public key into a JWK so that we can get the modulus to calculate a kid
  const jwk = publicKey.export({ format: "jwk" });
  const modulus = Buffer.from(jwk.n, "base64url");
  const privKeyPEM = privateKey.export({ format: "pem", type: "pkcs1" }).toString("utf8");
  const publicKeyPEM = publicKey.export({ format: "pem", type: "pkcs1" }).toString("utf8");

  const kid = crypto.createHash("sha1").update(modulus).digest("base64url");
  const SecretString = JSON.stringify({
    kid,
    ...additionalProperties,
    privateKey: privKeyPEM.replaceAll("\n", " "),
  });
  await sm_client.send(
    new sm.CreateSecretCommand({
      Name: SecretId,
      Description,
      SecretString,
      Tags: [
        {
          Key: "CreatedBy",
          Value: "CustomResourcePrivateKeyResourceProvider",
        },
      ],
    })
  );

  return {
    PhysicalResourceId: SecretId,
    Data: { kid, publicKeyPEM },
  };
}

async function onUpdate(evt) {
  // Do nothing for right now.
}

async function onDelete(evt) {
  const { SecretId } = evt.ResourceProperties;
  await sm_client.send(new sm.DeleteSecretCommand({ SecretId, ForceDeleteWithoutRecovery: true }));
}

exports.handler = async (event) => {
  console.log(event);
  switch (event.RequestType) {
    case "Create":
      return onCreate(event);
    case "Update":
      return onUpdate(event);
    case "Delete":
      return onDelete(event);
    default:
      throw new Error("Invlaid request type");
  }
};
