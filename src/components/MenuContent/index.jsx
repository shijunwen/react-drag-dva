import Home from "@/pages/Home";
import HooksShowcase from "@/pages/HooksShowcase";

const PAGE_MAP = {
  1: Home,
  5: HooksShowcase,
};

export default function MenuContent({ selectedKey }) {
  const Page = PAGE_MAP[selectedKey];
  return Page ? <Page /> : <Home />;
}
