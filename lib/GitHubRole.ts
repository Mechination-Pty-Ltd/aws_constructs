import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as iam from "aws-cdk-lib/aws-iam";

export const GITHUB_TOKEN_DOMAIN = "token.actions.githubusercontent.com";

export class GitHubIdentityProvider extends iam.OpenIdConnectProvider {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      url: `https://${GITHUB_TOKEN_DOMAIN}`,
      clientIds: ["sts.amazonaws.com"],
    });
  }
}

export interface GitHubRepositoryConfig {
  owner: string;
  repo: string;
  filter?: string;
}

export interface GitHubRoleProps extends Omit<iam.RoleProps, "assumedBy" | "provider"> {
  readonly provider: GitHubIdentityProvider;
  readonly repositoryConfig: GitHubRepositoryConfig[];
  /**
   * The list of managed policies that the deployment role will possess.  Use it to restrict what the actions are capable of performing.
   * @default: [iam.ManagedPolicy.fromAwsManagedPolicyName("AdministratorAccess")]
   */
  readonly managedPolicies?: iam.ManagedPolicy[];
}

/**
 * A specialised role used for allowing Github to deploy to an AWS account, via its OIDC provider.
 */
export class GitHubRole extends iam.Role {
  constructor(scope: Construct, id: string, props: GitHubRoleProps) {
    super(scope, id, {
      ...props,
      assumedBy: new iam.WebIdentityPrincipal(props.provider.openIdConnectProviderArn, {
        StringLike: {
          [`${GITHUB_TOKEN_DOMAIN}:sub`]: props.repositoryConfig.map((r) => `repo:${r.owner}/${r.repo}:${r.filter ?? "*"}`),
        },
      }),
      managedPolicies: props.managedPolicies ?? [iam.ManagedPolicy.fromAwsManagedPolicyName("AdministratorAccess")],
      description: props.description ?? "Used via GitHub Actions to deploy to this AWS account",
      maxSessionDuration: props.maxSessionDuration ?? cdk.Duration.hours(1),
    });
  }
}
