import { Body, Container, Head, Heading, Hr, Html, Preview, Text } from "@react-email/components";

export function WelcomeEmail(props: { name?: string }) {
  const name = props.name?.trim() || "there";

  return (
    <Html>
      <Head />
      <Preview>Welcome to GitPreflight</Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "ui-sans-serif, system-ui" }}>
        <Container style={{ margin: "0 auto", padding: "24px", maxWidth: "560px" }}>
          <Heading style={{ fontSize: "22px", margin: "0 0 12px" }}>Welcome, {name}</Heading>
          <Text style={{ fontSize: "14px", color: "#111827", lineHeight: "20px" }}>
            GitPreflight adds staged-only passport control to your commits.
          </Text>
          <Hr style={{ borderColor: "#e5e7eb", margin: "20px 0" }} />
          <Text style={{ fontSize: "12px", color: "#6b7280" }}>
            You can change notification preferences later.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
