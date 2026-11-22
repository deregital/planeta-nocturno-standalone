import type { Metadata } from 'next';

import Link from 'next/link';

import {
  Clause,
  LegalContact,
  LegalDocument,
  LegalSection,
} from '@/components/legal/LegalDocument';
import { AAIP_LEGEND, PLATFORM_NAME } from '@/lib/legal';
import { getLegalContext } from '@/server/legal';

export async function generateMetadata(): Promise<Metadata> {
  const { producerName } = await getLegalContext();
  return { title: `Política de privacidad · ${producerName}` };
}

export default async function PrivacyPolicyPage() {
  const { producerName, contactEmail, siteHost } = await getLegalContext();
  const contact = <LegalContact email={contactEmail} />;

  return (
    <LegalDocument
      title='Política de privacidad'
      intro={
        <p>
          La presente Política de Privacidad (en adelante, la «Política»)
          describe el tratamiento de los datos personales recolectados a través
          del sitio web {siteHost} (en adelante, el «Sitio»), de conformidad con
          la Ley N° 25.326 de Protección de los Datos Personales, su Decreto
          Reglamentario N° 1558/2001 y las disposiciones de la Agencia de Acceso
          a la Información Pública (en adelante, la «AAIP»). La aceptación de la
          Política, mediante la casilla habilitada al efecto en el proceso de
          compra o de aceptación de una Invitación, importa el consentimiento
          libre, expreso e informado del Titular en los términos de los
          artículos 5 y 6 de la Ley N° 25.326. La Política forma parte
          integrante de los{' '}
          <Link href='/terminos' className='font-medium underline'>
            Términos y Condiciones
          </Link>{' '}
          del Sitio.
        </p>
      }
    >
      <LegalSection title='1. Definiciones'>
        <p>
          A los efectos de la Política, los siguientes términos tendrán el
          significado que se indica:
        </p>
        <Clause n='1.1.'>
          «Productora / Establecimiento» (en adelante, la «Productora»):{' '}
          <strong>{producerName}</strong>, productora de los eventos ofrecidos
          en el Sitio o establecimiento en el que se realizan, y titular de
          ellos.
        </Clause>
        <Clause n='1.2.'>
          «Plataforma»: <strong>{PLATFORM_NAME}</strong>, proveedora del sistema
          informático de venta, emisión de entradas, invitaciones y control de
          acceso utilizado en el Sitio.
        </Clause>
        <Clause n='1.3.'>
          «Titular»: la persona humana cuyos datos personales son objeto de
          tratamiento, incluidos compradores, invitados y asistentes.
        </Clause>
        <Clause n='1.4.'>
          «Datos Personales»: información de cualquier tipo referida a personas
          humanas determinadas o determinables, conforme el artículo 2 de la Ley
          N° 25.326.
        </Clause>
        <Clause n='1.5.'>
          «Datos Disociados»: datos que no pueden asociarse a persona
          determinada o determinable.
        </Clause>
        <Clause n='1.6.'>
          «Entrada» e «Invitación»: el derecho de acceso a un evento adquirido a
          través del Sitio a título oneroso o gratuito, respectivamente.
        </Clause>
      </LegalSection>

      <LegalSection title='2. Responsables del tratamiento'>
        <Clause n='2.1.'>
          La Productora es responsable de la base de datos de compradores,
          invitados y asistentes de sus eventos.
        </Clause>
        <Clause n='2.2.'>
          La Plataforma trata dichos datos por cuenta de la Productora, en
          carácter de prestadora de servicios informáticos. Sin perjuicio de
          ello, la Plataforma reviste el carácter de responsable respecto de los
          tratamientos que realiza para finalidades propias enumeradas en la
          Política, en particular el envío de comunicaciones comerciales, la
          elaboración de perfiles y estadísticas, y la seguridad y mejora de sus
          servicios.
        </Clause>
        <Clause n='2.3.'>
          Toda consulta relativa al tratamiento de Datos Personales podrá
          dirigirse a {contact}.
        </Clause>
      </LegalSection>

      <LegalSection title='3. Datos Personales recolectados'>
        <Clause n='3.1.'>
          Datos suministrados por el Titular: nombre y apellido, número de
          Documento Nacional de Identidad (DNI), correo electrónico, número de
          teléfono, fecha de nacimiento, género, usuario de Instagram y las
          respuestas a los formularios que la Productora incorpore a cada
          evento. Cuando el evento así lo requiera, se recolectarán asimismo los
          datos de cada persona que asista con el comprador.
        </Clause>
        <Clause n='3.2.'>
          Nombre y apellido, DNI, correo electrónico, teléfono, fecha de
          nacimiento y género son de provisión obligatoria, por resultar
          necesarios para la emisión de la Entrada o Invitación; su omisión
          impide completar la operación. El usuario de Instagram y las
          respuestas no señaladas como obligatorias son de provisión
          facultativa.
        </Clause>
        <Clause n='3.3.'>
          Quien suministre Datos Personales de un tercero declara, bajo su
          exclusiva responsabilidad, contar con su autorización y haberle
          informado el contenido de la Política.
        </Clause>
        <Clause n='3.4.'>
          Datos generados por el uso del servicio: operaciones de compra,
          montos, medios y estado de pago, invitaciones y su emisor, registros
          de ingreso a los eventos, participación en sorteos y comunicaciones
          mantenidas con el Titular. Los datos de tarjetas son procesados
          exclusivamente por Mercado Pago y no son almacenados por la Productora
          ni por la Plataforma.
        </Clause>
        <Clause n='3.5.'>
          Datos técnicos: dirección IP, tipo de dispositivo y navegador, páginas
          visitadas, origen de la visita y patrones de uso del Sitio, obtenidos
          mediante cookies y herramientas de analítica.
        </Clause>
      </LegalSection>

      <LegalSection title='4. Finalidades del tratamiento'>
        <p>
          Los Datos Personales serán tratados con las siguientes finalidades:
        </p>
        <Clause n='4.1.'>
          Emitir, enviar y validar Entradas e Invitaciones, y controlar el
          acceso a los eventos.
        </Clause>
        <Clause n='4.2.'>Procesar pagos, reintegros y revocaciones.</Clause>
        <Clause n='4.3.'>Atender consultas y reclamos.</Clause>
        <Clause n='4.4.'>
          Verificar la identidad del Titular y la edad mínima exigida para cada
          evento, y prevenir fraudes, reventa y usos indebidos.
        </Clause>
        <Clause n='4.5.'>
          Registrar las ventas e invitaciones atribuibles a cada relacionista
          público (RRPP) o promotor, incluido el cálculo de comisiones, cupos y
          rankings.
        </Clause>
        <Clause n='4.6.'>
          Remitir comunicaciones comerciales, publicitarias e informativas, en
          los términos de la cláusula 6.
        </Clause>
        <Clause n='4.7.'>
          Elaborar perfiles de preferencias y hábitos de consumo, tales como
          tipo de eventos, frecuencia de asistencia y ubicación, a fin de
          personalizar los contenidos y ofertas.
        </Clause>
        <Clause n='4.8.'>
          Elaborar estadísticas, informes y estudios de mercado.
        </Clause>
        <Clause n='4.9.'>
          Resguardar la seguridad del Sitio, detectar y corregir errores, y
          mejorar y desarrollar productos y servicios, incluido el entrenamiento
          y la evaluación de modelos de análisis y de sistemas de inteligencia
          artificial.
        </Clause>
        <Clause n='4.10.'>
          Cumplir obligaciones legales y fiscales, atender requerimientos de
          autoridades competentes y ejercer o defender derechos en
          procedimientos administrativos o judiciales.
        </Clause>
      </LegalSection>

      <LegalSection title='5. Base legal y consentimiento'>
        <Clause n='5.1.'>
          El tratamiento de los datos necesarios para la emisión de la Entrada o
          Invitación se funda en la relación contractual con el Titular,
          conforme el artículo 5, inciso 2, apartado d) de la Ley N° 25.326.
        </Clause>
        <Clause n='5.2.'>
          Para las restantes finalidades, el Titular presta su consentimiento
          libre, expreso e informado mediante la aceptación de la Política.
        </Clause>
      </LegalSection>

      <LegalSection title='6. Comunicaciones comerciales y publicitarias'>
        <Clause n='6.1.'>
          El Titular consiente expresamente recibir de la Productora y de la
          Plataforma novedades, invitaciones, promociones y publicidad propias,
          de otros eventos comercializados a través de la Plataforma y de marcas
          asociadas, por correo electrónico, WhatsApp, mensajes de texto o
          notificaciones.
        </Clause>
        <Clause n='6.2.'>
          Las comunicaciones de marcas asociadas serán remitidas por la
          Productora o por la Plataforma, sin que ello implique la cesión de
          Datos Personales a dichas marcas.
        </Clause>
        <Clause n='6.3.'>
          El Titular podrá solicitar en cualquier momento, en forma gratuita, el
          retiro o bloqueo de su nombre de los listados utilizados con fines
          publicitarios, mediante el enlace incluido en cada comunicación o
          escribiendo a {contact}, conforme el artículo 27, inciso 3 de la Ley
          N° 25.326. La baja no afectará las Entradas o Invitaciones obtenidas.
        </Clause>
        <Clause n='6.4.'>
          No se remitirán comunicaciones que promocionen bebidas alcohólicas a
          menores de dieciocho (18) años, conforme la Ley N° 24.788.
        </Clause>
        <Clause n='6.5.'>
          Se respetará el Registro Nacional «No Llame» creado por la Ley N°
          26.951.
        </Clause>
      </LegalSection>

      <LegalSection title='7. Cesión de datos'>
        <Clause n='7.1.'>Los Datos Personales podrán ser comunicados:</Clause>
        <Clause n='a)' sub>
          a la Productora y a su personal autorizado (boletería, control de
          acceso, relacionistas públicos (RRPP), promotores y la persona que
          emitió la Invitación), en la medida necesaria para el cumplimiento de
          sus funciones. El emisor de una Invitación podrá acceder a los datos
          del invitado y a su registro de ingreso;
        </Clause>
        <Clause n='b)' sub>
          a los prestadores de servicios de alojamiento, bases de datos, envío
          de comunicaciones, analítica y procesamiento de pagos, quienes sólo
          podrán utilizarlos para la prestación de dichos servicios, en los
          términos del artículo 25 de la Ley N° 25.326;
        </Clause>
        <Clause n='c)' sub>
          a las autoridades judiciales o administrativas que así lo requieran en
          ejercicio de sus competencias;
        </Clause>
        <Clause n='d)' sub>
          al adquirente o continuador de la actividad de la Productora o de la
          Plataforma en caso de fusión, escisión, transferencia de fondo de
          comercio u otra reorganización, quien quedará obligado por la
          Política.
        </Clause>
        <Clause n='7.2.'>
          A la fecha no se ceden a marcas o socios comerciales Datos Personales
          que permitan identificar al Titular. Si en el futuro se previera tal
          cesión, se publicará en el Sitio la identidad de los cesionarios y la
          finalidad de la cesión, y se notificará al Titular por correo
          electrónico con antelación suficiente para que pueda oponerse.
        </Clause>
        <Clause n='7.3.'>
          Los Datos Disociados podrán ser comunicados libremente, conforme la
          cláusula 9.
        </Clause>
      </LegalSection>

      <LegalSection title='8. Transferencia internacional'>
        <Clause n='8.1.'>
          Los Datos Personales se alojan y procesan en servidores de los
          siguientes prestadores, ubicados en los Estados Unidos de América:
          Vercel (alojamiento del Sitio), Neon (base de datos), Amazon Web
          Services (almacenamiento de archivos), PostHog (analítica) y Resend
          (envío de correos electrónicos). Los pagos son procesados por Mercado
          Pago.
        </Clause>
        <Clause n='8.2.'>
          Los Estados Unidos de América no se encuentran entre los países con
          niveles de protección adecuados en los términos del artículo 12 de la
          Ley N° 25.326. El Titular presta su consentimiento expreso para dicha
          transferencia. La Productora y la Plataforma exigirán a dichos
          prestadores la adopción de medidas de seguridad y confidencialidad.
        </Clause>
        <Clause n='8.3.'>
          Todo cambio de prestador o de país se informará mediante la
          actualización de la presente cláusula, en los términos de la cláusula
          15.
        </Clause>
      </LegalSection>

      <LegalSection title='9. Datos Disociados'>
        <Clause n='9.1.'>
          La Productora y la Plataforma podrán disociar los Datos Personales y
          utilizar la información resultante, en forma individual o agregada con
          la de otros titulares y eventos, para elaborar estadísticas, informes
          y estudios, así como publicarla, cederla o comercializarla, sin
          limitación temporal.
        </Clause>
        <Clause n='9.2.'>
          La disociación se realizará mediante procedimientos que eliminen los
          identificadores directos y reduzcan el riesgo de identificación
          indirecta. La información que se publique o se comunique a terceros se
          presentará en forma agregada, en grupos no inferiores a cincuenta (50)
          titulares.
        </Clause>
        <Clause n='9.3.'>
          Quienes reciban Datos Disociados se obligarán a no intentar la
          identificación de los titulares, ni a combinarlos con otras fuentes
          con ese fin.
        </Clause>
        <Clause n='9.4.'>
          Conforme el artículo 28 de la Ley N° 25.326, los Datos Disociados no
          se encuentran alcanzados por la Política.
        </Clause>
      </LegalSection>

      <LegalSection title='10. Cookies y tecnologías similares'>
        <Clause n='10.1.'>
          El Sitio utiliza cookies propias necesarias para su funcionamiento,
          incluido el mantenimiento de reservas, y para autocompletar futuras
          compras en el mismo dispositivo, a cuyo efecto se almacenan en el
          navegador los datos de la última compra por un plazo de hasta un (1)
          año.
        </Clause>
        <Clause n='10.2.'>
          El Sitio utiliza herramientas de analítica que registran la navegación
          y pueden grabar sesiones con el fin de detectar errores. La
          información ingresada en formularios se oculta en dichas grabaciones.
        </Clause>
        <Clause n='10.3.'>
          El Titular puede bloquear o eliminar las cookies desde la
          configuración de su navegador, lo que podría afectar el funcionamiento
          del Sitio.
        </Clause>
      </LegalSection>

      <LegalSection title='11. Menores de edad'>
        <Clause n='11.1.'>
          El Titular menor de dieciocho (18) años declara contar con el
          conocimiento y la conformidad de sus padres o representantes legales
          para utilizar el Sitio y aceptar la Política.
        </Clause>
        <Clause n='11.2.'>
          Los Datos Personales de menores se tratarán para las mismas
          finalidades, con las siguientes limitaciones: no se les remitirán
          comunicaciones que promocionen bebidas alcohólicas, y no se difundirán
          imágenes que los identifiquen en forma individual sin su
          consentimiento y el de sus representantes legales, conforme el
          artículo 22 de la Ley N° 26.061.
        </Clause>
        <Clause n='11.3.'>
          Los representantes legales podrán ejercer los derechos del menor
          escribiendo a {contact}.
        </Clause>
      </LegalSection>

      <LegalSection title='12. Plazo de conservación'>
        <p>
          Los Datos Personales se conservarán mientras resulten necesarios para
          las finalidades previstas: los vinculados con Entradas, compras e
          Invitaciones, hasta cinco (5) años contados desde la última operación
          del Titular; los utilizados para comunicaciones comerciales, hasta que
          el Titular solicite la baja. Vencidos dichos plazos, serán suprimidos
          o disociados.
        </p>
      </LegalSection>

      <LegalSection title='13. Seguridad y confidencialidad'>
        <p>
          La Productora y la Plataforma adoptan medidas técnicas y organizativas
          razonables para garantizar la seguridad y confidencialidad de los
          Datos Personales, conforme los artículos 9 y 10 de la Ley N° 25.326, y
          restringen el acceso según el rol de cada usuario autorizado. Ningún
          sistema resulta absolutamente invulnerable; ante un incidente de
          seguridad se adoptarán las medidas necesarias para contenerlo.
        </p>
      </LegalSection>

      <LegalSection title='14. Derechos del Titular'>
        <Clause n='14.1.'>
          El Titular podrá ejercer en forma gratuita el derecho de acceso a sus
          Datos Personales, que será satisfecho dentro de los diez (10) días
          corridos de haber sido intimado fehacientemente, conforme el artículo
          14 de la Ley N° 25.326.
        </Clause>
        <Clause n='14.2.'>
          El Titular podrá solicitar la rectificación, actualización o supresión
          de sus datos, que se efectuará dentro de los cinco (5) días hábiles de
          recibido el reclamo, salvo que exista una obligación legal de
          conservarlos, conforme el artículo 16 de la Ley N° 25.326.
        </Clause>
        <Clause n='14.3.'>
          El Titular podrá revocar en cualquier momento el consentimiento
          prestado para las finalidades que no resulten necesarias para la
          emisión de la Entrada o Invitación.
        </Clause>
        <Clause n='14.4.'>
          Las solicitudes deberán dirigirse a {contact} desde la dirección de
          correo electrónico informada al obtener la Entrada o Invitación,
          consignando nombre, apellido y DNI.
        </Clause>
        <div className='flex flex-col gap-2 rounded-md bg-accent-ultra-light p-4 text-sm'>
          {AAIP_LEGEND.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </LegalSection>

      <LegalSection title='15. Modificaciones'>
        <p>
          La Productora y la Plataforma podrán modificar la Política. Las
          modificaciones se publicarán en el Sitio con una antelación no menor a
          diez (10) días corridos a su entrada en vigencia y, de resultar
          sustanciales, serán notificadas al Titular por correo electrónico. El
          Titular que no estuviera de acuerdo podrá solicitar la supresión de
          sus datos conforme la cláusula 14.
        </p>
      </LegalSection>

      <LegalSection title='16. Normativa aplicable'>
        <p>
          La Política se rige por la Ley N° 25.326, el Decreto N° 1558/2001 y
          sus normas complementarias, modificatorias y reglamentarias.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
