import { ContactForm } from "./contact-form"

export const metadata = { title: "Contact" }

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-3xl font-bold">Contact</h1>
      <p className="mt-2 text-muted-foreground">Send a message. We&apos;ll get back to you.</p>
      <ContactForm />
    </main>
  )
}
