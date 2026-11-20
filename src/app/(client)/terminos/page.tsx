import type { Metadata, Route } from 'next';

import Link from 'next/link';

import {
  Clause,
  LegalContact,
  LegalDocument,
  LegalSection,
} from '@/components/legal/LegalDocument';
import { CONSUMER_COMPLAINTS_URL, PLATFORM_NAME } from '@/lib/legal';
import { WITHDRAWAL_PATH } from '@/lib/withdrawal';
import { getLegalContext } from '@/server/legal';

export async function generateMetadata(): Promise<Metadata> {
  const { producerName } = await getLegalContext();
  return { title: `Términos y condiciones · ${producerName}` };
}

export default async function TermsPage() {
  const { producerName, contactEmail, siteHost } = await getLegalContext();
  const contact = <LegalContact email={contactEmail} />;

  return (
    <LegalDocument
      title='Términos y condiciones'
      intro={
        <p>
          Los presentes Términos y Condiciones (en adelante, los «Términos»)
          regulan el acceso y uso del sitio web {siteHost} (en adelante, el
          «Sitio»), así como la adquisición de Entradas y la aceptación de
          Invitaciones para los Eventos ofrecidos en él. La aceptación de los
          Términos, mediante la casilla habilitada al efecto, es condición
          necesaria para completar cualquier operación e importa la adhesión del
          Usuario a la totalidad de sus cláusulas y a la{' '}
          <Link href='/privacidad' className='font-medium underline'>
            Política de Privacidad
          </Link>
          , que forma parte integrante de ellos.
        </p>
      }
    >
      <LegalSection title='1. Definiciones'>
        <p>
          A los efectos de los Términos, los siguientes términos tendrán el
          significado que se indica:
        </p>
        <Clause n='1.1.'>
          «Productora / Establecimiento» (en adelante, la «Productora»):{' '}
          <strong>{producerName}</strong>, productora de los Eventos ofrecidos
          en el Sitio o establecimiento en el que se realizan, responsable de su
          producción y realización.
        </Clause>
        <Clause n='1.2.'>
          «Plataforma»: <strong>{PLATFORM_NAME}</strong>, proveedora del sistema
          informático de venta, emisión de entradas, invitaciones y control de
          acceso.
        </Clause>
        <Clause n='1.3.'>
          «Usuario»: toda persona que acceda al Sitio, adquiera una Entrada o
          acepte una Invitación.
        </Clause>
        <Clause n='1.4.'>
          «Evento»: el espectáculo, fiesta o actividad ofrecido en el Sitio.
        </Clause>
        <Clause n='1.5.'>
          «Entrada»: el derecho de acceso a un Evento adquirido a título
          oneroso, representado por un código QR único.
        </Clause>
        <Clause n='1.6.'>
          «Invitación»: el derecho de acceso a un Evento otorgado a título
          gratuito.
        </Clause>
        <Clause n='1.7.'>
          «Cargo por Servicio»: el importe adicional al precio de la Entrada en
          concepto de uso del sistema de venta, que se informa al Usuario antes
          del pago.
        </Clause>
      </LegalSection>

      <LegalSection title='2. Partes y rol de la Plataforma'>
        <Clause n='2.1.'>
          La Productora es la proveedora de los Eventos y la única responsable
          de su organización, realización, contenido, seguridad y condiciones,
          así como de los reintegros que correspondan.
        </Clause>
        <Clause n='2.2.'>
          La Plataforma actúa exclusivamente como proveedora de la herramienta
          tecnológica que permite la comercialización de Entradas, la emisión de
          Invitaciones y el control de acceso. No organiza, produce ni explota
          los Eventos.
        </Clause>
      </LegalSection>

      <LegalSection title='3. Entradas'>
        <Clause n='3.1.'>
          Las Entradas son personales y nominativas, se emiten a nombre y DNI de
          su titular y contienen un código QR único.
        </Clause>
        <Clause n='3.2.'>
          El primer escaneo válido del código habilita el ingreso y agota la
          Entrada. El Usuario es el único responsable de la custodia del código;
          ni la Productora ni la Plataforma responderán por copias, capturas o
          reenvíos que permitan su utilización por terceros.
        </Clause>
        <Clause n='3.3.'>
          El Usuario garantiza la veracidad de los datos consignados. Quien
          consigne datos de terceros declara contar con su autorización.
        </Clause>
        <Clause n='3.4.'>
          Se prohíbe la reventa y toda forma de comercialización de Entradas sin
          autorización expresa de la Productora. Las Entradas revendidas,
          duplicadas, obtenidas con datos falsos, mediante medios automatizados
          o en forma fraudulenta podrán ser anuladas sin derecho a reintegro.
        </Clause>
        <Clause n='3.5.'>
          La anulación se resolverá previa revisión de la operación, y se
          conservará la evidencia que la funde. Si se comprobara que la
          operación era legítima, se restituirá la Entrada o, de no ser posible,
          se reintegrará el importe abonado.
        </Clause>
      </LegalSection>

      <LegalSection title='4. Precio, Cargo por Servicio y medios de pago'>
        <Clause n='4.1.'>
          El precio de las Entradas es fijado por la Productora. Al precio podrá
          adicionarse el Cargo por Servicio, que será informado al Usuario con
          anterioridad al pago.
        </Clause>
        <Clause n='4.2.'>
          El pago podrá efectuarse mediante Mercado Pago o los demás medios
          habilitados para cada Evento, y la operación se perfecciona con la
          acreditación del pago. Hasta ese momento, las Entradas permanecerán
          reservadas por el plazo informado durante el proceso de compra,
          vencido el cual la reserva caducará de pleno derecho.
        </Clause>
        <Clause n='4.3.'>
          El Cargo por Servicio retribuye el uso del sistema de venta y será
          reintegrado únicamente en caso de ejercicio del derecho de revocación
          previsto en la cláusula 8 o cuando una norma imperativa así lo
          disponga.
        </Clause>
        <Clause n='4.4.'>
          Los descuentos y códigos promocionales se rigen por las condiciones de
          cada Evento y no son acumulables, salvo indicación en contrario.
        </Clause>
      </LegalSection>

      <LegalSection title='5. Invitaciones'>
        <Clause n='5.1.'>
          Las Invitaciones son otorgadas por la Productora o por las personas
          que ésta habilite, revisten carácter personal, se encuentran sujetas a
          disponibilidad de cupo y pueden ser revocadas por la Productora hasta
          el momento del ingreso.
        </Clause>
        <Clause n='5.2.'>
          Cada código de Invitación es de uso único y corresponde a la primera
          persona que complete el proceso de aceptación.
        </Clause>
      </LegalSection>

      <LegalSection title='6. Acceso y permanencia en el Evento'>
        <Clause n='6.1.'>
          Para ingresar, el Usuario deberá exhibir la Entrada o Invitación junto
          con su documento de identidad. El incumplimiento de la edad mínima
          establecida para el Evento impedirá el ingreso, sin derecho a
          reintegro.
        </Clause>
        <Clause n='6.2.'>
          La Productora se reserva el derecho de admisión y permanencia, que
          ejercerá conforme la normativa vigente y sin discriminación, y podrá
          establecer normas de seguridad, controles y horarios de ingreso. El
          reingreso quedará a exclusivo criterio de la Productora.
        </Clause>
        <Clause n='6.3.'>
          Las condiciones particulares de cada Evento (fecha, horario, lugar,
          edad mínima, artistas y demás) publicadas por la Productora en el
          Sitio forman parte integrante de los Términos.
        </Clause>
      </LegalSection>

      <LegalSection title='7. Modificación, reprogramación, suspensión y cancelación'>
        <Clause n='7.1.'>
          La Productora podrá modificar artistas, horarios u otras condiciones
          no esenciales del Evento, sin que ello otorgue derecho a reintegro.
        </Clause>
        <Clause n='7.2.'>
          En caso de reprogramación o cambio de lugar, la Entrada conservará su
          validez para la nueva fecha o lugar. El Usuario que no pudiera asistir
          podrá solicitar a la Productora el reintegro del precio de la Entrada
          con anterioridad a la realización del Evento.
        </Clause>
        <Clause n='7.3.'>
          En caso de cancelación, la Productora reintegrará el precio de la
          Entrada por el mismo medio de pago utilizado. Los reintegros son
          gestionados por la Productora; la Plataforma presta únicamente
          asistencia técnica.
        </Clause>
      </LegalSection>

      <LegalSection title='8. Derecho de revocación'>
        <p>
          El Usuario que haya adquirido Entradas a través del Sitio podrá
          revocar la aceptación dentro de los diez (10) días corridos contados
          desde la entrega de la Entrada o del comprobante de pago, lo que
          ocurra primero, sin responsabilidad alguna y sin necesidad de invocar
          causa, siempre que lo solicite con una antelación mínima de
          veinticuatro (24) horas al inicio del Evento y que la Entrada no haya
          sido utilizada, conforme el artículo 34 de la Ley N° 24.240 y los
          artículos 1110 a 1116 del Código Civil y Comercial de la Nación.
        </p>
        <p>
          La solicitud se realiza desde el{' '}
          <Link
            href={WITHDRAWAL_PATH as Route}
            className='font-medium underline'
          >
            Botón de arrepentimiento
          </Link>{' '}
          disponible en el pie de todas las páginas del Sitio, sin necesidad de
          registrarse, con el correo electrónico y el DNI informados en la
          compra. La Plataforma envía a ese correo un enlace para elegir la
          compra y, al confirmarla, informa al Usuario en el momento un número
          de trámite, que también remite por correo electrónico. Las Entradas
          revocadas quedan anuladas desde la confirmación. La Productora
          reintegrará la totalidad de lo abonado, incluido el Cargo por
          Servicio, por el mismo medio de pago utilizado. Ante cualquier
          inconveniente con el Botón de arrepentimiento, la solicitud podrá
          remitirse a {contact}, indicando nombre, apellido, DNI y Evento.
        </p>
        <p>
          El derecho de revocación no aplica a las Invitaciones ni a las
          Entradas sin cargo.
        </p>
      </LegalSection>

      <LegalSection title='9. Limitación de responsabilidad'>
        <Clause n='9.1.'>
          La Plataforma no será responsable por la realización, contenido,
          seguridad o condiciones de los Eventos, ni por los reintegros a cargo
          de la Productora.
        </Clause>
        <Clause n='9.2.'>
          Ni la Productora ni la Plataforma serán responsables por fallas de
          conectividad o de los dispositivos del Usuario, por servicios de
          terceros tales como Mercado Pago o los proveedores de correo
          electrónico, ni por el uso de las Entradas por terceros a quienes el
          Usuario las hubiera facilitado.
        </Clause>
        <Clause n='9.3.'>
          Las limitaciones precedentes rigen en la máxima medida permitida por
          la legislación aplicable y no afectan los derechos reconocidos al
          Usuario por la Ley N° 24.240 de Defensa del Consumidor.
        </Clause>
      </LegalSection>

      <LegalSection title='10. Usos prohibidos'>
        <p>
          Queda prohibido utilizar robots, scripts u otros medios automatizados
          para reservar, adquirir o consultar el Sitio; interferir en su
          funcionamiento; y utilizar datos de terceros sin autorización. Ante
          cualquiera de dichas conductas, la Productora y la Plataforma podrán
          bloquear el acceso, anular reservas u operaciones y formular las
          denuncias pertinentes.
        </p>
      </LegalSection>

      <LegalSection title='11. Derechos de imagen'>
        <Clause n='11.1.'>
          En los Eventos se capturan fotografías y videos del público y del
          ambiente. La asistencia al Evento importa la autorización del Usuario,
          en los términos del artículo 53 del Código Civil y Comercial de la
          Nación, para que la Productora y la Plataforma capten, reproduzcan y
          difundan, a título gratuito, por cualquier medio y sin limitación
          territorial, las imágenes y la voz del Usuario con fines de difusión y
          promoción del Evento, de la Productora y de la Plataforma, conforme
          las cláusulas siguientes.
        </Clause>
        <Clause n='11.2.'>
          Tomas generales: las imágenes del público y del ambiente en las que el
          Usuario aparezca en forma incidental podrán utilizarse sin limitación
          temporal.
        </Clause>
        <Clause n='11.3.'>
          Imágenes identificables: las imágenes en las que el Usuario pueda ser
          identificado individualmente podrán utilizarse con los fines indicados
          hasta que el Usuario revoque la autorización, lo que podrá hacer en
          cualquier momento conforme el artículo 55 del Código Civil y Comercial
          de la Nación. La revocación tendrá efectos para el futuro: la
          Productora y la Plataforma retirarán dichas imágenes de los canales
          bajo su control dentro de un plazo razonable, sin responsabilidad por
          las copias difundidas previamente por terceros.
        </Clause>
        <Clause n='11.4.'>
          Campañas publicitarias: la utilización de la imagen del Usuario como
          protagonista de una pieza publicitaria, o asociada a una marca de modo
          que sugiera su recomendación, requerirá una autorización específica,
          previa y por escrito.
        </Clause>
        <Clause n='11.5.'>
          No se difundirán imágenes que identifiquen en forma individual a
          menores de edad sin su consentimiento y el de sus representantes
          legales.
        </Clause>
        <Clause n='11.6.'>
          Las solicitudes de remoción o revocación deberán dirigirse a {contact}
          .
        </Clause>
      </LegalSection>

      <LegalSection title='12. Propiedad intelectual'>
        <p>
          Las marcas, logotipos, diseños y contenidos del Sitio son de
          titularidad de la Productora, de la Plataforma o de sus licenciantes,
          y no podrán ser utilizados sin autorización previa y por escrito.
        </p>
      </LegalSection>

      <LegalSection title='13. Datos personales'>
        <p>
          El tratamiento de los datos personales del Usuario, incluido el envío
          de comunicaciones comerciales, se rige por la{' '}
          <Link href='/privacidad' className='font-medium underline'>
            Política de Privacidad
          </Link>
          , que forma parte integrante de los Términos.
        </p>
      </LegalSection>

      <LegalSection title='14. Modificaciones'>
        <p>
          La Productora y la Plataforma podrán modificar los Términos. Las
          modificaciones se publicarán en el Sitio con una antelación no menor a
          diez (10) días corridos a su entrada en vigencia. Cada operación se
          regirá por los Términos vigentes al momento de su celebración.
        </p>
      </LegalSection>

      <LegalSection title='15. Ley aplicable y jurisdicción'>
        <p>
          Los Términos se rigen por las leyes de la República Argentina. Toda
          controversia será sometida a los tribunales ordinarios de la Ciudad
          Autónoma de Buenos Aires, sin perjuicio del derecho del Usuario, en su
          carácter de consumidor, de accionar ante los tribunales de su
          domicilio.
        </p>
      </LegalSection>

      <LegalSection title='16. Consultas y reclamos'>
        <p>
          Las consultas y reclamos podrán dirigirse a {contact}. Asimismo, el
          Usuario podrá formular reclamos ante la autoridad de aplicación de la
          Ley N° 24.240:{' '}
          <a
            href={CONSUMER_COMPLAINTS_URL}
            target='_blank'
            rel='noopener noreferrer'
            className='font-medium underline'
          >
            Defensa de las y los consumidores. Para reclamos ingrese aquí
          </a>
          .
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
