import type { Deal } from "@/lib/dealsStore";
import type { CRMContact } from "@/lib/crmContactsStore";
import type { CRMCompany } from "@/lib/crmCompaniesStore";
import { buildSearchText } from "@/lib/searchMatch";

/**
 * Índice de busca de uma negociação: texto de um lado, campos numéricos do outro.
 *
 * O documento vem da EMPRESA vinculada e dos CONTATOS da negociação — nunca de `deal.cnpj` /
 * `deal.cpf`, que existem no tipo mas não têm coluna em `crm_deals` e chegam sempre vazios. Era por
 * isso que procurar negociação por CPF ou CNPJ nunca achava nada (medido em produção, 10/09).
 *
 * Os números ficam separados do texto porque a base guarda mascarado — 155 dos 156 CNPJs estão como
 * "00.000.000/0000-00" — e quem busca digita só os dígitos. `matchesSearchTerm` compara os dois
 * lados por dígitos.
 */
export interface DealSearchIndex {
  text: string;
  digits: Array<string | undefined>;
}

export const buildDealSearchIndex = (
  deal: Deal,
  contacts: CRMContact[],
  companies: CRMCompany[],
  dealDisplayName?: string,
): DealSearchIndex => {
  const contactIds = [deal.primaryContactId, deal.contactId, ...(deal.contactIds || [])].filter(
    (id): id is string => Boolean(id),
  );
  const dealContacts = Array.from(new Set(contactIds))
    .map((id) => contacts.find((contact) => contact.id === id))
    .filter((contact): contact is CRMContact => Boolean(contact));

  const linkedCompany = deal.companyId ? companies.find((company) => company.id === deal.companyId) : undefined;

  return {
    text: buildSearchText([
      dealDisplayName,
      deal.dealName,
      deal.dealCode,
      deal.id,
      deal.contactName,
      deal.companyName || linkedCompany?.name,
      deal.email,
      ...dealContacts.map((contact) => contact.name),
      ...dealContacts.map((contact) => contact.email),
    ]),
    digits: [
      linkedCompany?.cnpj,
      deal.phone,
      ...dealContacts.map((contact) => contact.cpf),
      ...dealContacts.map((contact) => contact.phone),
    ],
  };
};
