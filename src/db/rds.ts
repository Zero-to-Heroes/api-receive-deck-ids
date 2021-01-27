/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable @typescript-eslint/no-var-requires */
import { SecretsManager } from 'aws-sdk';
import { GetSecretValueRequest } from 'aws-sdk/clients/secretsmanager';
import { default as MySQLServerless, default as serverlessMysql } from 'serverless-mysql';
import { getSecret, SecretInfo } from './secrets';

const secretsManager = new SecretsManager({ region: 'us-west-2' });
let connection, connectionPromise;

const connect = async (): Promise<serverlessMysql.ServerlessMysql> => {
	const secretRequest: GetSecretValueRequest = {
		SecretId: 'rds-connection',
	};
	const secret: SecretInfo = await getSecret(secretsManager, secretRequest);
	const config = {
		host: secret.host,
		user: secret.username,
		password: secret.password,
		database: 'replay_summary',
		port: secret.port,
	};
	connection = MySQLServerless({ config });

	return connection;
};

const getConnection = async (): Promise<serverlessMysql.ServerlessMysql> => {
	if (connection) {
		return connection;
	}
	if (connectionPromise) {
		return connectionPromise;
	}
	connectionPromise = connect();

	return connectionPromise;
};

export { getConnection };
