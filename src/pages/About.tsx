import { Info, MapPin, Mail, Globe, Shield } from "lucide-react";

const About = () => (
  <div className="animate-fade-in px-4 py-6 space-y-6">
    {/* Header */}
    <div className="text-center space-y-1">
      <div className="w-16 h-16 rounded-full gradient-secondary mx-auto flex items-center justify-center shadow-lg">
        <Info className="w-8 h-8 text-secondary-foreground" />
      </div>
      <h1 className="text-xl font-heading font-bold text-foreground mt-3">About AICloudHub</h1>
      <p className="text-xs text-muted-foreground">Sri Lanka's #1 AI GPU Rental Platform</p>
    </div>

    {/* Description */}
    <div className="shadow-neu rounded-2xl bg-card p-5 space-y-3">
      <p className="text-sm text-foreground leading-relaxed">
        AICloudHub is Sri Lanka's premier artificial intelligence cloud computing platform. We provide
        cutting-edge GPU rental services, AI model hosting, and vector database solutions to
        businesses and individuals across the region.
      </p>
      <p className="text-sm text-foreground leading-relaxed">
        Our mission is to democratize AI computing power, making advanced machine learning
        capabilities accessible and affordable for everyone. With state-of-the-art data centers
        and a dedicated support team, we ensure maximum uptime and performance.
      </p>
    </div>

    {/* Contact Info */}
    <div className="shadow-neu rounded-2xl bg-card p-5 space-y-4">
      <h2 className="text-sm font-heading font-bold text-foreground">Contact Information</h2>
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-xs font-medium text-foreground">Address</p>
            <p className="text-[11px] text-muted-foreground">42/B, Galle Road, Colombo 03, Sri Lanka</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Mail className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-xs font-medium text-foreground">Email</p>
            <p className="text-[11px] text-muted-foreground">support@aicloudhub.com</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Globe className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-xs font-medium text-foreground">Website</p>
            <p className="text-[11px] text-muted-foreground">www.aicloudhub.com</p>
          </div>
        </div>
      </div>
    </div>

    {/* Trust badges */}
    <div className="shadow-neu rounded-2xl bg-card p-4 flex items-center gap-3">
      <Shield className="w-5 h-5 text-secondary shrink-0" />
      <p className="text-[11px] text-muted-foreground">
        Licensed and regulated. All transactions are encrypted and secured with industry-standard protocols.
      </p>
    </div>
  </div>
);

export default About;
