import { Body, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from "@react-email/components";

export function InviteEmail(props: {
  orgName: string;
  inviteCode: string;
  acceptUrl: string;
}) {
  const { orgName, inviteCode, acceptUrl } = props;

  return (
    <Html>
      <Head />
      <Preview>You’ve been invited to join {orgName} on GitPreflight</Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "ui-sans-serif, system-ui" }}>
        <Container style={{ margin: "0 auto", padding: "24px", maxWidth: "560px" }}>
          <Heading style={{ fontSize: "22px", margin: "0 0 12px" }}>Join {orgName} on GitPreflight</Heading>
          <Text style={{ fontSize: "14px", color: "#111827", lineHeight: "20px" }}>
            You’ve been invited to join <strong>{orgName}</strong>.
          </Text>
          <Section>
            <Text style={{ fontSize: "14px", color: "#111827" }}>
              Invite code:
            </Text>
            <Text style={{ fontFamily: "ui-monospace, SFMono-Regular", fontSize: "16px", marginTop: "6px" }}>
              {inviteCode}
            </Text>
            <Text style={{ fontSize: "14px", color: "#111827" }}>
              Accept: <Link href={acceptUrl}>{acceptUrl}</Link>
            </Text>
          </Section>
          <Hr style={{ borderColor: "#e5e7eb", margin: "20px 0" }} />
          <Text style={{ fontSize: "12px", color: "#6b7280" }}>
            If you weren’t expecting this, you can ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
