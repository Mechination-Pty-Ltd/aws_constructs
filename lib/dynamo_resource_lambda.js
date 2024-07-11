const ddb = require("@aws-sdk/client-dynamodb");
const ddbUtil = require("@aws-sdk/util-dynamodb");
const dynamo = new ddb.DynamoDBClient({});

const hashKey = (key) => Buffer.from(JSON.stringify(key), "utf8").toString("base64");

async function onCreate(evt) {
  const { TableName, Item, Key } = evt.ResourceProperties;

  await dynamo.send(new ddb.PutItemCommand({ TableName, Item: ddbUtil.marshall({ ...Item, ...Key }) }));
  return {
    PhysicalResourceId: hashKey(Key),
  };
}

async function onUpdate(evt) {
  // Update the item.
  onCreate(evt);
}

async function onDelete(evt) {
  const { TableName, Key } = evt.ResourceProperties;
  await dynamo.send(new ddb.DeleteItem({ TableName, Key: ddbUtil.marshall(Key) }));
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
