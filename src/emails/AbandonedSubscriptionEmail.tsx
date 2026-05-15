import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface AbandonedSubscriptionEmailProps {
  name: string;
}

const brandPurple = '#5B21B6';
const brandPurpleLight = '#f3eeff';
const brandPurpleDark = '#3b0764';
const black = '#111111';
const grey = '#6b7280';
const lightGrey = '#f9f9f9';
const white = '#ffffff';
const borderColor = '#e5e7eb';

export function AbandonedSubscriptionEmail({ name = 'there' }: AbandonedSubscriptionEmailProps) {
  const firstName = name.split(' ')[0];

  return (
    <Html>
      <Head />
      <Preview>
        {firstName}, Where did you go? your store upgrade is waiting — pick a plan and start selling smarter 🚀
      </Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>

          {/* Header */}
          <Section style={headerStyle}>
            <Text style={logoStyle}>SellQuic</Text>
            <Text style={taglineStyle}>Sell smarter. Grow faster.</Text>
          </Section>

          {/* Hero */}
          <Section style={heroStyle}>
            <Text style={heroEmojiStyle}>👀</Text>
            <Heading style={heroHeadingStyle}>
              You were so close, {firstName}!
            </Heading>
            <Text style={heroSubStyle}>
              You checked out our plans but didn't complete your upgrade. No worries — everything is still here waiting for you.
            </Text>
          </Section>

          {/* Body */}
          <Section style={bodyContentStyle}>
            <Text style={bodyTextStyle}>
              Hi {firstName},
            </Text>
            <Text style={bodyTextStyle}>
              Selling online shouldn't be stressful. SellQuic handles the hard parts — so you can focus on what matters: growing.
            </Text>
            <Text style={bodyTextStyle}>
              Here's what you unlock when you upgrade:
            </Text>
          </Section>

          {/* Plans */}
          <Section style={plansContainerStyle}>

            {/* Premium Plan — highlighted / Most Popular */}
            <Section style={planCardFeaturedStyle}>
              <Row>
                <Column>
                  <Text style={featuredBadgeStyle}>⭐ Most Popular</Text>
                </Column>
              </Row>
              <Row>
                <Column>
                  <Text style={planNameFeaturedStyle}>Premium</Text>
                  <Text style={planDescFeaturedStyle}>For serious sellers</Text>
                </Column>
                <Column align="right">
                  <Text style={planPriceFeaturedStyle}>
                    GHS 69<span style={planPriceSuffixFeaturedStyle}>/month</span>
                  </Text>
                  <Text style={planQuarterlyFeaturedStyle}>or GHS 199/quarter</Text>
                </Column>
              </Row>
              <Hr style={planDividerFeaturedStyle} />
              <Row>
                <Column>
                  <Text style={featureFeaturedStyle}>✓ &nbsp; 1 Store Link</Text>
                  <Text style={featureFeaturedStyle}>✓ &nbsp; Unlimited Products</Text>
                  <Text style={featureFeaturedStyle}>✓ &nbsp; AI Description Generator</Text>
                  <Text style={featureFeaturedStyle}>✓ &nbsp; AI Shopping Assistant &nbsp;<span style={comingSoonFeaturedStyle}>coming soon</span></Text>
                </Column>
              </Row>
            </Section>

            {/* Business Plan */}
            <Section style={planCardStyle}>
              <Row>
                <Column>
                  <Text style={planNameStyle}>Business</Text>
                  <Text style={planDescStyle}>For power sellers</Text>
                </Column>
                <Column align="right">
                  <Text style={planPriceStyle}>
                    GHS 129<span style={planPriceSuffixStyle}>/month</span>
                  </Text>
                  <Text style={planQuarterlyStyle}>or GHS 369/quarter</Text>
                </Column>
              </Row>
              <Hr style={planDividerStyle} />
              <Row>
                <Column>
                  <Text style={featureStyle}>✓ &nbsp; Up to 5 Stores</Text>
                  <Text style={featureStyle}>✓ &nbsp; Unlimited Products</Text>
                  <Text style={featureStyle}>✓ &nbsp; AI Description Generator</Text>
                  <Text style={featureStyle}>✓ &nbsp; AI Shopping Assistant &nbsp;<span style={comingSoonStyle}>coming soon</span></Text>
                  <Text style={featureStyle}>✓ &nbsp; Team Access (Up to 3 members)</Text>
                  <Text style={featureStyle}>✓ &nbsp; Dedicated Support</Text>
                </Column>
              </Row>
            </Section>

          </Section>

          {/* Quarterly savings tip */}
          <Section style={tipSectionStyle}>
            <Text style={tipTextStyle}>
              💡 Save 5% when you pay quarterly on any plan
            </Text>
          </Section>

          {/* CTA */}
          <Section style={ctaSectionStyle}>
            <Button style={ctaButtonStyle} href="https://sellquic.com/dashboard/subscription">
              View Plans & Upgrade Now
            </Button>
          </Section>

          {/* Reassurance */}
          <Section style={reassuranceSectionStyle}>
            <Text style={reassuranceTextStyle}>
              Ran into an issue with payment? Just reply to this email and we'll sort it out for you right away. We're always here to help 💜
            </Text>
          </Section>

          <Hr style={dividerStyle} />

          {/* Sign off */}
          <Section style={signoffSectionStyle}>
            <Text style={signoffTextStyle}>
              Warm regards,
            </Text>
            <Text style={signoffNameStyle}>Rena</Text>
            <Text style={signoffRoleStyle}>For the SellQuic Team</Text>
          </Section>

          {/* Footer */}
          <Section style={footerStyle}>
            <Text style={footerTextStyle}>
              © {new Date().getFullYear()} SellQuic · Ghana
            </Text>
            <Text style={footerTextStyle}>
              <a href="https://sellquic.com" style={footerLinkStyle}>sellquic.com</a>
              {' · '}
              <a href="https://sellquic.com/dashboard/subscription" style={footerLinkStyle}>Manage Subscription</a>
            </Text>
            <Text style={footerSmallStyle}>
              You're receiving this because you started an upgrade on SellQuic.
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
}

export default AbandonedSubscriptionEmail;

// ─── Styles ───────────────────────────────────────────────────

const bodyStyle: React.CSSProperties = {
  backgroundColor: '#f4f4f5',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  margin: 0,
  padding: '32px 0',
};

const containerStyle: React.CSSProperties = {
  backgroundColor: white,
  borderRadius: '12px',
  maxWidth: '560px',
  margin: '0 auto',
  overflow: 'hidden',
  border: `1px solid ${borderColor}`,
};

const headerStyle: React.CSSProperties = {
  backgroundColor: brandPurple,
  padding: '28px 32px',
  textAlign: 'center',
};

const logoStyle: React.CSSProperties = {
  color: white,
  fontSize: '26px',
  fontWeight: '800',
  margin: '0',
  letterSpacing: '-0.5px',
};

const taglineStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.75)',
  fontSize: '13px',
  margin: '4px 0 0',
};

const heroStyle: React.CSSProperties = {
  backgroundColor: brandPurpleLight,
  padding: '32px 32px 24px',
  textAlign: 'center',
};

const heroEmojiStyle: React.CSSProperties = {
  fontSize: '40px',
  margin: '0 0 12px',
};

const heroHeadingStyle: React.CSSProperties = {
  color: black,
  fontSize: '24px',
  fontWeight: '700',
  margin: '0 0 12px',
  lineHeight: '1.3',
};

const heroSubStyle: React.CSSProperties = {
  color: grey,
  fontSize: '15px',
  margin: '0',
  lineHeight: '1.6',
};

const bodyContentStyle: React.CSSProperties = {
  padding: '28px 32px 0',
};

const bodyTextStyle: React.CSSProperties = {
  color: '#374151',
  fontSize: '15px',
  lineHeight: '1.7',
  margin: '0 0 16px',
};

const plansContainerStyle: React.CSSProperties = {
  padding: '8px 32px 0',
};

const planCardStyle: React.CSSProperties = {
  backgroundColor: lightGrey,
  border: `1px solid ${borderColor}`,
  borderRadius: '10px',
  padding: '20px',
  marginBottom: '12px',
};

const planCardFeaturedStyle: React.CSSProperties = {
  backgroundColor: brandPurple,
  borderRadius: '10px',
  padding: '20px',
  marginBottom: '12px',
};

const planNameStyle: React.CSSProperties = {
  color: black,
  fontSize: '18px',
  fontWeight: '700',
  margin: '0',
};

const planDescStyle: React.CSSProperties = {
  color: grey,
  fontSize: '13px',
  margin: '2px 0 0',
};

const planNameFeaturedStyle: React.CSSProperties = {
  color: white,
  fontSize: '18px',
  fontWeight: '700',
  margin: '0',
};

const planDescFeaturedStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.75)',
  fontSize: '13px',
  margin: '2px 0 0',
};

const planPriceStyle: React.CSSProperties = {
  color: brandPurple,
  fontSize: '22px',
  fontWeight: '800',
  margin: '0',
};

const planPriceSuffixStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: '400',
  color: grey,
};

const planPriceFeaturedStyle: React.CSSProperties = {
  color: white,
  fontSize: '22px',
  fontWeight: '800',
  margin: '0',
};

const planPriceSuffixFeaturedStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: '400',
  color: 'rgba(255,255,255,0.75)',
};

const planQuarterlyStyle: React.CSSProperties = {
  color: grey,
  fontSize: '12px',
  margin: '2px 0 0',
  textAlign: 'right',
};

const planQuarterlyFeaturedStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.65)',
  fontSize: '12px',
  margin: '2px 0 0',
  textAlign: 'right',
};

const featuredBadgeStyle: React.CSSProperties = {
  backgroundColor: 'rgba(255,255,255,0.2)',
  color: white,
  fontSize: '11px',
  fontWeight: '600',
  padding: '3px 10px',
  borderRadius: '20px',
  display: 'inline-block',
  margin: '0 0 12px',
};

const planDividerStyle: React.CSSProperties = {
  borderColor: borderColor,
  margin: '14px 0',
};

const planDividerFeaturedStyle: React.CSSProperties = {
  borderColor: 'rgba(255,255,255,0.25)',
  margin: '14px 0',
};

const featureStyle: React.CSSProperties = {
  color: '#374151',
  fontSize: '14px',
  margin: '0 0 6px',
};

const featureFeaturedStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.92)',
  fontSize: '14px',
  margin: '0 0 6px',
};

const tipSectionStyle: React.CSSProperties = {
  padding: '16px 32px 0',
  textAlign: 'center',
};

const tipTextStyle: React.CSSProperties = {
  backgroundColor: '#fef9c3',
  color: '#854d0e',
  fontSize: '13px',
  padding: '10px 16px',
  borderRadius: '8px',
  display: 'inline-block',
  margin: '0',
};

const ctaSectionStyle: React.CSSProperties = {
  padding: '28px 32px',
  textAlign: 'center',
};

const ctaButtonStyle: React.CSSProperties = {
  backgroundColor: brandPurple,
  borderRadius: '8px',
  color: white,
  fontSize: '16px',
  fontWeight: '700',
  padding: '14px 36px',
  textDecoration: 'none',
  display: 'inline-block',
};

const reassuranceSectionStyle: React.CSSProperties = {
  padding: '0 32px 28px',
};

const reassuranceTextStyle: React.CSSProperties = {
  backgroundColor: brandPurpleLight,
  border: `1px solid #ddd6fe`,
  borderRadius: '8px',
  color: brandPurpleDark,
  fontSize: '14px',
  lineHeight: '1.6',
  padding: '14px 16px',
  margin: '0',
  textAlign: 'center',
};

const dividerStyle: React.CSSProperties = {
  borderColor: borderColor,
  margin: '0 32px',
};

const signoffSectionStyle: React.CSSProperties = {
  padding: '24px 32px 8px',
};

const signoffTextStyle: React.CSSProperties = {
  color: grey,
  fontSize: '14px',
  margin: '0',
};

const signoffNameStyle: React.CSSProperties = {
  color: black,
  fontSize: '15px',
  fontWeight: '700',
  margin: '4px 0 0',
};

const signoffRoleStyle: React.CSSProperties = {
  color: grey,
  fontSize: '13px',
  margin: '2px 0 0',
};

const footerStyle: React.CSSProperties = {
  backgroundColor: lightGrey,
  borderTop: `1px solid ${borderColor}`,
  padding: '20px 32px',
  textAlign: 'center',
};

const footerTextStyle: React.CSSProperties = {
  color: grey,
  fontSize: '12px',
  margin: '0 0 4px',
};

const footerLinkStyle: React.CSSProperties = {
  color: brandPurple,
  textDecoration: 'none',
};

const footerSmallStyle: React.CSSProperties = {
  color: '#9ca3af',
  fontSize: '11px',
  margin: '8px 0 0',
};

const comingSoonStyle: React.CSSProperties = {
  backgroundColor: '#f3f4f6',
  color: '#6b7280',
  fontSize: '10px',
  fontWeight: '600',
  padding: '2px 7px',
  borderRadius: '20px',
  textTransform: 'uppercase',
  letterSpacing: '0.3px',
};

const comingSoonFeaturedStyle: React.CSSProperties = {
  backgroundColor: 'rgba(255,255,255,0.2)',
  color: 'rgba(255,255,255,0.85)',
  fontSize: '10px',
  fontWeight: '600',
  padding: '2px 7px',
  borderRadius: '20px',
  textTransform: 'uppercase',
  letterSpacing: '0.3px',
};